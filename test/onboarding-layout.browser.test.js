const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");

const browserPath = "/Applications/Helium.app/Contents/MacOS/Helium";
const helpPage = pathToFileURL(path.resolve("safari/SAMS Portal Autofill/SAMS Portal Autofill/Resources/Base.lproj/Main.html")).href;
// Main.storyboard gives the non-resizable window and its web view a 425x325 content size.
const windowSize = { width: 425, height: 325 };

for (const textScale of [1, 1.5]) {
  test(`containing-app help keeps every element reachable at 425x325 with ${textScale * 100}% text and an error shown`, async () => {
    const browser = await chromium.launch({ executablePath: browserPath, headless: true });
    try {
      const page = await browser.newPage({ viewport: windowSize });
      await page.goto(helpPage);
      const layout = await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${scale * 100}%`;
        show(false, true);
        showError("open-settings");
        const scroller = document.scrollingElement;
        scroller.scrollTop = 0;
        const visible = [...document.body.children].filter((element) => element.getClientRects().length);
        return {
          scrollHeight: scroller.scrollHeight,
          tops: visible.map((element) => Math.round(element.getBoundingClientRect().top)),
          bottoms: visible.map((element) => Math.round(element.getBoundingClientRect().bottom)),
          names: visible.map((element) => element.className || element.tagName.toLowerCase()),
        };
      }, textScale);
      assert.deepEqual(layout.names, ["img", "state-off", "guidance", "note", "note", "error", "open-preferences"]);
      for (const [index, top] of layout.tops.entries()) {
        assert.ok(top >= 0, `${layout.names[index]} starts above the scrollable area at ${top}px`);
        assert.ok(layout.bottoms[index] <= layout.scrollHeight, `${layout.names[index]} ends below the scrollable area`);
      }
    } finally {
      await browser.close();
    }
  });
}
