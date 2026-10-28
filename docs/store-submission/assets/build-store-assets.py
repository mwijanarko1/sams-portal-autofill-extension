#!/usr/bin/env python3
"""Build the local DRAFT Chrome Web Store images from the reviewed synthetic sources.

Run from the repository root: python3 docs/store-submission/assets/build-store-assets.py
Needs Pillow and macOS Helvetica Neue at FONT below. No network or live data.

Sources (assets/source/) are real toolbar-popup captures taken by
`npm run test:e2e` (Helium, CDP Page.captureScreenshot, DPR 2, synthetic
student Aisha Rahman, apply.example-university.test) plus the runtime icon128.png.
Screenshots are scaled uniformly and never redrawn. Regenerated captures must be
looked at again before replacing the files in assets/source/.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
SRC = HERE / "source"

INK = (38, 34, 97)  # #262261, popup h1
BODY = (100, 116, 139)  # #64748b, popup subtitle
PAGE = (245, 243, 255)  # #f5f3ff, popup background
STAGE = (231, 228, 245)  # neutral backdrop around an authentic capture
EDGE = (199, 210, 254)  # #c7d2fe, popup card border
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"  # 0 regular, 1 bold

REVIEW = "local draft, pending publisher review"
SYNTHETIC = "synthetic: Aisha Rahman, apply.example-university.test; no live CRM or portal data"


def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def screenshot(source, heading, caption, popup_height, out):
    """1280x800 canvas: caption on the left, authentic capture scaled uniformly on the right."""
    cap = Image.open(SRC / source).convert("RGB")
    scale = popup_height / cap.height
    shot = cap.resize((round(cap.width * scale), popup_height), Image.LANCZOS)
    canvas = Image.new("RGB", (1280, 800), STAGE)

    x = 1280 - 120 - shot.width
    y = (800 - shot.height) // 2
    shadow = Image.new("RGBA", (1280, 800), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x, y + 10, x + shot.width, y + shot.height + 10), 18, fill=(38, 34, 97, 60)
    )
    canvas.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(shot, (x, y))
    ImageDraw.Draw(canvas).rectangle((x - 1, y - 1, x + shot.width, y + shot.height), outline=EDGE)

    d = ImageDraw.Draw(canvas)
    text_width = x - 100 - 60
    heading_lines = wrap(d, heading, font(48, True), text_width)
    block = len(heading_lines) * 58 + 18 + 38 * len(wrap(d, caption, font(26), text_width))
    ty = (800 - block) // 2
    for line in heading_lines:
        d.text((100, ty), line, font=font(48, True), fill=INK)
        ty += 58
    ty += 18
    for line in wrap(d, caption, font(26), text_width):
        d.text((100, ty), line, font=font(26), fill=BODY)
        ty += 38
    canvas.save(out, optimize=True)


def promo(out):
    """440x280 small promotional tile: existing icon plus the two scoped lines."""
    img = Image.new("RGB", (440, 280), PAGE)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 8, 280), fill=INK)
    icon = Image.open(SRC / "icon128.png").convert("RGBA").resize((72, 72), Image.LANCZOS)
    d.rounded_rectangle((40, 50, 128, 138), 18, fill=(255, 255, 255), outline=EDGE)
    img.paste(icon, (48, 58), icon)
    d.text((40, 156), "SAMS Portal Autofill", font=font(31, True), fill=INK)
    d.text((40, 204), "For authorised SAMS staff", font=font(19), fill=BODY)
    img.save(out, optimize=True)


def store_icon(out):
    """128x128 store icon: the 128 runtime icon (opaque, 0 px padding, measured) at 96x96 inside 16 px transparent padding."""
    icon = Image.open(SRC / "icon128.png").convert("RGBA")
    box = icon.getchannel("A").getbbox()
    assert box == (0, 0, 128, 128), f"icon128 already padded ({box}); do not pad twice"
    canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    canvas.paste(icon.resize((96, 96), Image.LANCZOS), (16, 16))
    canvas.save(out, optimize=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    outputs = {
        "store-screenshot-1-1280x800-draft.png": lambda p: screenshot(
            "popup-generic-success.png",
            "Draft only",
            "Review every field, complete the rest, and submit it yourself.",
            740,
            p,
        ),
        "store-screenshot-2-1280x800-draft.png": lambda p: screenshot(
            "site-access-granted-before.png",
            "One website at a time",
            "Allow access to one university website only. You can revoke access in browser settings.",
            380,
            p,
        ),
        "store-promo-small-440x280-draft.png": promo,
        "store-icon-128-draft.png": store_icon,
    }
    manifest = {"review_status": REVIEW, "synthetic_data": SYNTHETIC, "assets": []}
    for name, build in outputs.items():
        path = HERE / name
        build(path)
        im = Image.open(path)
        manifest["assets"].append(
            {"file": name, "width": im.width, "height": im.height, "mode": im.mode, "sha256": sha(path)}
        )
    manifest["sources"] = [
        {
            "file": f"source/{name}",
            "sha256": sha(SRC / name),
            "origin": origin,
        }
        for name, origin in [
            ("popup-generic-success.png", "tmp/general-portal-evidence/popup-generic-success.png, npm run test:e2e 2026-10-22T13:20:23Z, 780x1084, CSS 390x542 at DPR 2"),
            ("site-access-granted-before.png", "tmp/general-portal-evidence/site-access-granted-before.png, npm run test:e2e 2026-10-22T13:20:21Z, 780x486, DPR 2"),
            ("icon128.png", "repository icon128.png, copied unchanged"),
        ]
    ]
    (HERE / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for a in manifest["assets"]:
        print(f'{a["file"]}: {a["width"]}x{a["height"]} {a["mode"]}')


if __name__ == "__main__":
    main()
