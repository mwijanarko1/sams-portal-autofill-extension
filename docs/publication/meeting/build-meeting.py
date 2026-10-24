"""Build the offline meeting pack from the current reviewed privacy draft."""
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
PUBLICATION = ROOT.parent
ORIGIN = "https://github.com/mwijanarko1/sams-portal-autofill-extension"
SOURCE = PUBLICATION / "PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md"

AGENDA = [
    ("Priorities", "3 min", "Confirm that these are still the acceptance priorities.", [
        "Per-page autofill and optional fill-all.",
        "CRM document attachment without manual downloading and re-uploading.",
        "Support beyond three mapped universities, with clear limits.",
        "Correct nationality, agency attribution and British dates.",
    ]),
    ("Core workflow", "5 min", "Use an approved test student, not a real application.", [
        "Copy from CRM, confirm the student and inspect the copied details.",
        "Autofill one page; review filled, unmatched and manual fields.",
        "Run Autofill again and confirm existing values are preserved.",
        "Show Clear and safely switch to another student.",
    ]),
    ("Nationality and country of birth", "4 min", "Requested safeguard: the dedicated recheck prompt has not been demonstrated.", [
        "Show that nationality and country of birth are separate values.",
        "Check what happens when either value is missing or already populated.",
        "Agree the acknowledgement staff must make before continuing.",
    ]),
    ("Agency attribution", "5 min", "Greater Manchester agency fields currently stay manual. That is not an agency safeguard.", [
        "Have SAMS show the correct agency selection on a postgraduate application.",
        "Identify which portals derive attribution from login and which need a dropdown.",
        "Agree the warning or blocking behaviour when SAMS attribution is missing.",
    ]),
    ("Both filling modes", "5 min", "Fill-all has synthetic-test evidence, not completed live or actual-Safari acceptance.", [
        "Show Autofill this page first, then Autofill all & save on synthetic fixtures.",
        "Show required-field stops, run progress and Stop.",
        "Explain that a draft save can persist remotely and Clear cannot undo it.",
        "Keep declaration, payment and final submission under staff control.",
    ]),
    ("CRM documents", "5 min", "Some portals upload immediately on attachment. Use synthetic documents unless a live upload is explicitly approved.", [
        "List CRM documents, select one for an upload field and attach it.",
        "Confirm that this solves their workflow despite not being drag-and-drop.",
        "Check filenames, document categories, multiple files and size limits.",
    ]),
    ("Other universities and dates", "5 min", "Shared matching is not a promise to complete every field on every university website.", [
        "Show common-field matching on an unmapped test form.",
        "Confirm the next priority universities and the fields that remain manual.",
        "Check that 05/06/2000 means 5 June, plus separate day/month/year controls.",
    ]),
    ("Acceptance, privacy and rollout", "8 min", "Agree named owners and dates. This walkthrough does not approve publication.", [
        "Schedule supervised acceptance on Bangor, Greenwich and Greater Manchester.",
        "Have Hadi or Adnan operate the workflow themselves.",
        "Arrange actual-Safari acceptance; the unsigned dev build is not release proof.",
        "Review the privacy addendum and identify who can approve and publish it.",
        "Assign the in-product disclosure/consent requirement and confirm developer-account ownership and controlled distribution.",
        "Follow up on promised dev-platform access; Campora configuration still blocks production builds.",
    ]),
]

CSS = """
:root{color-scheme:light;--ink:var(--foreground,#232135);--sub:var(--muted-foreground,#5c5a6d);--line:var(--border,#dedce6);--tone:var(--card,#f7f6fb);--brand:#393174;--paper:var(--background,#fff);font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif)}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:transparent;font-size:15px;line-height:1.55}a{color:inherit;text-underline-offset:4px;overflow-wrap:anywhere}a:hover{color:#6755b7}button,input,textarea{font:inherit}button,a,input,textarea{touch-action:manipulation}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #8071c2;outline-offset:4px}::selection{background:#dcd4ff;color:#24203d}.shell{max-width:1120px;margin:auto}.top{display:flex;gap:20px;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid var(--line)}.name{font-weight:750;letter-spacing:-.02em}.top nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}.top a[aria-current=page]{font-weight:700;text-decoration-thickness:2px}.layout{display:grid;grid-template-columns:210px minmax(0,1fr);gap:48px;padding-top:32px}.rail{font-size:13px}.rail-inner{position:sticky;top:24px}.rail h2{font-size:15px;margin:22px 0 9px}.rail p{color:var(--sub)}.rail a{display:block;margin:10px 0}.rail .count{font-size:20px;color:var(--ink);font-variant-numeric:tabular-nums;margin:0}.status{display:block;color:var(--sub);min-height:42px}.tools{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,.button{padding:8px 13px;background:var(--paper);border:1px solid var(--line);border-radius:7px;cursor:pointer;color:var(--ink);font-size:13px;text-decoration:none}button:hover{background:var(--tone)}button:active{transform:translateY(1px)}h1{font-size:34px;line-height:1.15;letter-spacing:-.03em;margin:0 0 13px}h2{font-size:21px;line-height:1.3;letter-spacing:-.015em;margin:0 0 8px}h3{font-size:16px;margin:25px 0 10px}p{margin:0 0 14px}.intro{color:var(--sub);max-width:65ch}.notice{padding:16px;background:var(--tone);border-radius:12px;margin:22px 0 28px;font-size:14px}.notice strong{display:block;margin-bottom:5px}.section{padding:24px 0;border-top:1px solid var(--line);break-inside:avoid}.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:15px}.time{white-space:nowrap;color:var(--sub);font-size:13px;font-variant-numeric:tabular-nums}.note{font-size:13px;color:var(--sub);margin-bottom:13px}.checks{list-style:none;padding:0;margin:0}.checks li+li{margin-top:5px}.check{display:flex;gap:12px;align-items:flex-start;padding:6px 0;cursor:pointer}.check input{width:19px;height:19px;flex:0 0 19px;margin:3px 0 0;accent-color:var(--brand)}.check:has(input:checked) span{color:var(--sub);text-decoration:line-through;text-decoration-color:#a9a4b9}.check span{max-width:69ch}.decisions{padding-top:25px;border-top:1px solid var(--line);margin-top:8px}.decision{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px;margin:15px 0}.decision strong{font-size:14px}.decision label{font-size:12px;display:grid;gap:5px}input[type=text],textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);padding:9px}textarea{min-height:110px;resize:vertical}.privacy{max-width:73ch}.privacy p{margin-bottom:17px}.privacy h2{margin-top:32px}.privacy h3{font-size:17px}.privacy li{margin-bottom:9px}.draft{font-weight:700;color:var(--ink)}details{border-top:1px solid var(--line);padding:18px 0;margin-top:30px}summary{cursor:pointer;font-weight:650}.review-list{padding-left:22px}.footer{margin:35px 0 20px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--sub)}[hidden]{display:none!important}.skip{position:absolute;left:-9999px}.skip:focus{position:static}noscript{display:block;padding:14px;background:var(--tone)}
@media(max-width:760px){.layout{grid-template-columns:1fr;gap:22px;padding-top:24px}.rail-inner{position:static}.rail .links,.rail h2{display:none}.rail .count{font-size:16px}.rail .status{min-height:0}.rail .tools{margin-bottom:0}.top{align-items:flex-start;gap:13px;flex-direction:column}.top nav{gap:15px}h1{font-size:29px}.section{padding:20px 0}.decision{grid-template-columns:1fr 1fr}.decision strong{grid-column:1/-1}.notice{margin:20px 0}.rail p{margin-bottom:0}}
@media print{body{color:#111;background:#fff;font-size:11pt}.top nav,.rail,.tools,.skip,.screen-only{display:none!important}.layout{display:block;padding-top:15px}.shell{max-width:none}.top{padding:0 0 12px}h1{font-size:24pt}h2{font-size:15pt}.notice{background:#f3f3f3;color:#111}.section{padding:14px 0}.section p{color:#333}.check:has(input:checked) span{color:#333}.check input{appearance:auto}a{color:#111}details{display:block}details>*{display:block!important}.footer{margin-top:15px}input[type=text],textarea{color:#111;border-color:#999}button{display:none}.decision{break-inside:avoid}}
"""

def inline(text):
    text = escape(text)
    return re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)

def privacy_content():
    source = SOURCE.read_text()
    insertion = source.split("## Insertion text (copy-ready draft)\n", 1)[1].split("## Internal drafting notes", 1)[0]
    paragraphs = []
    for block in insertion.strip().split("\n>\n"):
        text = " ".join(line.removeprefix("> ").strip() for line in block.splitlines() if line.strip() != ">")
        if not text:
            continue
        if re.fullmatch(r"\*\*[^*]+\*\*", text):
            paragraphs.append(f"<h2>{inline(text)}</h2>")
        else:
            paragraphs.append(f"<p>{inline(text)}</p>")
    notes = source.split("### SAMS review checklist (unresolved)\n", 1)[1]
    items = re.findall(r"^\d+\. (.+)$", notes, re.M)
    checklist = "".join(f"<li>{inline(item)}</li>" for item in items)
    return f'''<h1>Privacy addendum</h1><p class="intro">Proposed insertion into the existing SAMS privacy policy.</p>
    <div class="notice"><strong>Draft. Not published, not approved, not legally reviewed.</strong>Effective date and organisational decisions remain for SAMS. The existing website policy has not been changed.</div>
    <p><a href="https://samscrm.co.uk/privacy-policy/" target="_blank" rel="noopener noreferrer">Read the existing public privacy policy</a></p>
    <details><summary>Suggested insertion point</summary><p>After the existing sharing subsections 1.1 to 1.6, before the access-request paragraph. Suggested section 1.7: SAMS Portal Autofill browser extension. Leave the existing clauses unchanged.</p></details>
    <article class="privacy">{"".join(paragraphs)}</article>
    <details open><summary>SAMS review checklist, not part of the proposed public wording</summary><ol class="review-list">{checklist}</ol></details>'''

def checklist_content():
    sections = []
    for group_index, (title, minutes, note, tasks) in enumerate(AGENDA):
        checks = "".join(f'<li><label class="check"><input type="checkbox" data-save="check-{group_index}-{index}"><span>{escape(task)}</span></label></li>' for index, task in enumerate(tasks))
        sections.append(f'<section class="section"><div class="section-head"><h2>{escape(title)}</h2><span class="time">{minutes}</span></div><p class="note">{escape(note)}</p><ul class="checks">{checks}</ul></section>')
    decisions = "".join(f'<div class="decision"><strong>{title}</strong><label>Owner<input type="text" data-save="owner-{i}" autocomplete="off"></label><label>Due date<input type="text" data-save="due-{i}" placeholder="Agreed date" autocomplete="off"></label></div>' for i, title in enumerate(["Nationality recheck and agency safeguard", "Supervised portal and Safari acceptance", "Privacy wording and in-product consent", "Developer accounts and controlled rollout"]))
    return f'''<h1>Meeting checklist</h1><p class="intro">A 35 to 45 minute walkthrough of the requests from the last meeting, followed by clear owners and dates.</p>
    <div class="notice"><strong>Two promises to address explicitly</strong>The dedicated nationality recheck tick-box and agency-tagging safeguard have not been demonstrated. Do not present either as finished.</div>
    {"".join(sections)}<section class="decisions"><h2>Leave with owners and dates</h2><p class="note">Keep notes about decisions only. Do not enter student details, credentials or private application data.</p>{decisions}<label for="meeting-notes"><strong>Decisions and follow-ups</strong></label><textarea id="meeting-notes" data-save="notes" placeholder="What was agreed? What remains open?"></textarea></section>'''

RELEASE = '''<h1>Release status and references</h1><p class="intro">Use this page to separate evidence from work still needed. Status reflects local preparation on 22 October 2026, not a release approval.</p>
<section class="section"><h2>Verified locally</h2><ul><li>Loaded-extension synthetic E2E: 28/28; fill-all: 9/9; portal fill-all: 12/12.</li><li>Supporting existing tests: 108/108. These are not live-portal acceptance.</li><li>Unsigned Safari development app builds with 23 matching extension resources.</li><li>Store submission drafts and synthetic store images are prepared.</li></ul></section>
<section class="section"><h2>Still outstanding</h2><ul><li>Actual Safari behaviour and supervised live acceptance across all three portals.</li><li>Confirmed production Campora configuration. Both production builds remain blocked.</li><li>Approved production identifiers, signing and controlled distribution.</li><li>SAMS review and publication of the privacy amendment, plus an in-product disclosure/consent step.</li><li>Nationality recheck and agency-attribution safeguards need explicit follow-up.</li></ul></section>
<section class="section"><h2>Demonstrate safely</h2><p>Use approved synthetic data and documents. Show fill-all on synthetic fixtures, not a real application. A portal may save or upload immediately. Clear and Stop cannot undo a remote save or recall an operation already underway.</p></section>
<section class="section"><h2>Repository and supporting documents</h2><p><a href="https://github.com/mwijanarko1/sams-portal-autofill-extension" target="_blank" rel="noopener noreferrer">GitHub origin: mwijanarko1/sams-portal-autofill-extension</a></p><p>Read from local Git configuration. Repository access may require the correct GitHub account. Local draft files are not claimed to be committed or available on GitHub.</p><p><a href="../PREPARATION-REPORT.md">Preparation report (local Markdown)</a><br><a href="../STORE-SUBMISSION-PACK.md">Store submission pack (local Markdown)</a><br><a href="../PRIVACY-POLICY-EXTENSION-ADDENDUM-DRAFT.md">Privacy addendum source (local Markdown)</a></p></section>'''

SCRIPT = """
(() => {
 const key='sams-meeting-checklist-v1';
 const fields=[...document.querySelectorAll('[data-save]')];
 const checks=fields.filter(el=>el.type==='checkbox');
 const status=document.getElementById('save-status');
 const progress=document.getElementById('progress');
 let stored={}; let available=true;
 try { stored=JSON.parse(localStorage.getItem(key)||'{}'); if(!stored||typeof stored!=='object'||Array.isArray(stored))stored={}; }
 catch { available=false; status.textContent='Storage unavailable. You can still use and print this checklist.'; }
 fields.forEach(el=>{const value=stored[el.dataset.save];if(el.type==='checkbox')el.checked=value===true;else if(typeof value==='string')el.value=value;});
 const count=()=>{progress.textContent=checks.filter(el=>el.checked).length+' of '+checks.length+' discussed';};
 function save(){count();if(!available)return;try{const next={};fields.forEach(el=>next[el.dataset.save]=el.type==='checkbox'?el.checked:el.value);localStorage.setItem(key,JSON.stringify(next));status.textContent='Saved in this browser only.';}catch{available=false;status.textContent='Could not save. Print to keep your notes.';}}
 fields.forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',save));count();
 document.getElementById('reset').addEventListener('click',()=>{if(!confirm('Clear this meeting checklist and all meeting notes in this browser?'))return;fields.forEach(el=>{if(el.type==='checkbox')el.checked=false;else el.value='';});save();});
 document.querySelectorAll('[data-print]').forEach(el=>el.addEventListener('click',()=>window.print()));
 function show(page){if(!['checklist','privacy','release'].includes(page))page='checklist';document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==page);document.querySelectorAll('[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});document.getElementById('meeting-controls').hidden=page!=='checklist';document.title=({checklist:'Meeting checklist',privacy:'Privacy addendum draft',release:'Release status'})[page]+' | SAMS Portal Autofill';}
 document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();location.hash=el.dataset.page;}));
 window.addEventListener('hashchange',()=>show(location.hash.slice(1)));show(location.hash.slice(1)||document.body.dataset.start);
 if(!available)status.textContent='Storage unavailable. You can still use and print this checklist.';
})();
"""

def document(start):
    panels = {"checklist": checklist_content(), "privacy": privacy_content(), "release": RELEASE}
    rendered = "".join(f'<div data-panel="{page}"{(" hidden" if page != start else "")}>{content}</div>' for page, content in panels.items())
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>SAMS meeting pack</title><style>{CSS}</style></head><body data-start="{start}"><a class="skip" href="#main">Skip to content</a><div class="shell"><header class="top"><span class="name">SAMS Portal Autofill</span><nav aria-label="Meeting pack"><a href="index.html" data-page="checklist">Checklist</a><a href="privacy-addendum.html" data-page="privacy">Privacy addendum</a><a href="release-status.html" data-page="release">Release status</a></nav></header><div class="layout"><aside class="rail"><div class="rail-inner"><div id="meeting-controls"><p class="count" id="progress" role="status" aria-live="polite"></p><p class="status" id="save-status" role="status">Saved in this browser only.</p><div class="tools"><button type="button" id="reset">Reset checklist</button></div></div><div class="tools"><button type="button" data-print>Print / save PDF</button></div><div class="links"><h2>Sources and links</h2><a href="{ORIGIN}" target="_blank" rel="noopener noreferrer">GitHub origin</a><a href="https://samscrm.co.uk/privacy-policy/" target="_blank" rel="noopener noreferrer">Existing privacy policy</a><p>Prepared from the last meeting transcript and current local release evidence.</p><p>22 October 2026<br>Development walkthrough, not publication approval.</p></div></div></aside><main id="main" tabindex="-1">{rendered}<footer class="footer">Local meeting pack. No analytics, external scripts or background requests. Checkmarks and notes stay in this browser when storage is available. Share the whole meeting folder to retain the separate HTML pages.</footer></main></div></div><noscript>JavaScript is off. Checkboxes work but do not save; use the page links to open each document and your browser's Print command.</noscript><script>{SCRIPT}</script></body></html>'''

if __name__ == "__main__":
    for filename, start in [("index.html", "checklist"), ("privacy-addendum.html", "privacy"), ("release-status.html", "release")]:
        output = ROOT / filename
        output.write_text(document(start))
        print(f"Built {output.name}: {output.stat().st_size} bytes")
