// Page side of the optional fill-all run. It is injected by the worker into one exact document and
// called only through chrome.scripting.executeScript, which runs in this extension's isolated world:
// page scripts cannot reach SAMS_FILL_ALL_PAGE, and no listener here accepts messages.
//
// One request describes the document: { origin, path, kind, config, visited, bind, runId, runStartedAt, target?, fieldMap? }.
// `kind` selects how the portal moves on, and every kind answers the same operations:
//   form-post          native POST form per screen, screens listed by path (Bangor)
//   checklist-link     a checklist page of GET links to native POST sections of one application (Greenwich)
//   same-document-tab  lazy tabs inside one document, saved by script-driven buttons (Greater Manchester)
//   generic-post       an unmapped site: one explicit Save and continue to a page of the same application
if (!globalThis.SAMS_FILL_ALL_PAGE) {
  const WRONG_PAGE = "The portal page changed before this step could run.";
  const OFF_LIMITS = "The form would save to a page Fill all does not handle.";
  const OTHER_APPLICATION = "The portal moved to a different application, so Fill all stopped.";
  const STAFF_TOUCHED = "The page was used while Fill all was running, so Fill all stopped.";
  const STALE_RUN = "This request belongs to an earlier Fill all run, so it was ignored.";
  const STILL_LOADING = "The screen is still loading, so Fill all stopped before changing it.";
  const NOTHING_TO_FILL = "This screen has no fields that Fill all can fill. Continue manually.";
  const MAX_LABELS = 5;

  const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const controlText = (control) => normalize(control instanceof HTMLInputElement ? control.value : control.textContent);

  function fieldLabel(element) {
    const label = normalize(element.labels && element.labels[0] && element.labels[0].textContent);
    return (label || element.name || element.id || "Unlabelled field").slice(0, 80);
  }

  // Words of a final step. A supported screen that shows any of these is not a plain data-entry screen,
  // so the run stops rather than fill or save it. Deliberately broad: a false stop is only manual work.
  const FORBIDDEN_CONTROL = /\b(?:submit|pay(?:ment)?|declar(?:e|ation)|confirm|finali[sz]e|authori[sz]e)\b/i;
  const FORBIDDEN_HEADING = /\b(?:declaration|submit (?:your |the )?application|confirm(?:ation)? (?:and submit|of (?:your )?application|your application)|pay(?:ment)? (?:now|details|due)|card (?:number|details))\b/i;
  const FORBIDDEN_CHECKBOX = /\b(?:i declare|i certify|declaration)\b/i;

  // `scope` is the whole document, or the one tab panel that is open: a hidden panel's declaration
  // checkbox is not part of the screen being filled.
  function forbiddenContent(scope) {
    const control = [...scope.querySelectorAll("button, input[type='submit'], input[type='button'], input[type='image'], [role='button']")]
      .find((candidate) => visible(candidate) && FORBIDDEN_CONTROL.test(
        controlText(candidate) || normalize(candidate.getAttribute("aria-label") || candidate.getAttribute("alt") || candidate.title)));
    if (control) return "This screen has a submit, payment, declaration or confirmation control, so Fill all will not run on it.";
    const heading = [...scope.querySelectorAll("h1, h2, h3, h4, legend")]
      .find((candidate) => visible(candidate) && FORBIDDEN_HEADING.test(normalize(candidate.textContent)));
    if (heading) return "This screen looks like a declaration, payment or final confirmation, so Fill all will not run on it.";
    const payment = scope.querySelector("input[autocomplete^='cc-'], input[name*='cardnumber' i], input[name*='card_number' i]");
    if (payment) return "This screen asks for payment details, so Fill all will not run on it.";
    const checkbox = [...scope.querySelectorAll("input[type='checkbox']")]
      .find((candidate) => FORBIDDEN_CHECKBOX.test(normalize([...(candidate.labels || [])].map((label) => label.textContent).join(" "))));
    if (checkbox) return "This screen has a declaration checkbox, so Fill all will not run on it.";
    return "";
  }

  // Attributes and platform getters are read from the prototypes, never from the elements, because a
  // form control named "action", "method", "elements" or "querySelector" shadows the property of the
  // same name on its form while the browser still acts on the real attribute.
  const attr = (element, name) => Element.prototype.getAttribute.call(element, name);
  const has = (element, name) => Element.prototype.hasAttribute.call(element, name);
  const within = (element, selector) => Element.prototype.querySelectorAll.call(element, selector);
  const getter = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name).get;
  const formAction = getter(HTMLFormElement.prototype, "action");
  const formElements = getter(HTMLFormElement.prototype, "elements");
  const buttonAction = getter(HTMLButtonElement.prototype, "formAction");
  const inputAction = getter(HTMLInputElement.prototype, "formAction");

  // Same checks as the per-page handler: this origin, not sandboxed, the top page, the expected path.
  function contextProblem(request) {
    if (!globalThis.SAMS_ENGINE) return "Autofill engine is unavailable.";
    if (location.origin !== request.origin || self.origin !== request.origin) return WRONG_PAGE;
    try {
      if (window.top !== window) return WRONG_PAGE;
    } catch {
      return WRONG_PAGE;
    }
    return location.pathname === request.path ? "" : WRONG_PAGE;
  }

  // ---- Application binding and unmapped-site routes -------------------------------------------------

  // The single value of the hidden field that names the application, or "" when absent or ambiguous.
  function boundValue(root, field) {
    const inputs = root === document ? document.querySelectorAll(`input[type='hidden'][name='${field}']`) : within(root, `input[type='hidden'][name='${field}']`);
    const values = [...new Set([...inputs].map((input) => input.value.trim()))];
    return values.length === 1 ? values[0] : "";
  }

  // Words of a submission, declaration, payment, sign-in or account route. A button saying Save and
  // continue cannot make a destination like these acceptable.
  const BLOCKED_ROUTE = /(?:^|[^a-z])(?:submit|submission|final|finali[sz]e|finish|complete|completed|confirm|confirmation|declare|declaration|pay|payment|payments|checkout|billing|login|logout|signin|signout|register|password|reset|delete|withdraw|cancel|exit)(?:[^a-z]|$)/i;
  // The application an unmapped path belongs to: its parent directory. Root-level paths have none.
  const appRoute = (path) => path.replace(/\/+$/, "").replace(/\/[^/]*$/, "");

  // Identity of a screen from its route, visible heading and field schema. Values are never read.
  function fingerprint(path) {
    const heading = normalize([...document.querySelectorAll("h1, h2, legend")].find(visible)?.textContent).toLowerCase().slice(0, 80);
    const schema = [...document.querySelectorAll("input, select, textarea")]
      .filter((control) => !["hidden", "submit", "button", "reset", "image"].includes(attr(control, "type")))
      .map((control) => `${attr(control, "name") || control.id}:${attr(control, "type") || control.localName}`).sort().join(",");
    let hash = 0x811c9dc5;
    for (const char of `${path.replace(/\/+$/, "")}|${heading}|${schema}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
    return (hash >>> 0).toString(16);
  }

  // ---- Screens: what is this document? --------------------------------------------------------------
  // role: step (data entry), hub (a page of links to steps), boundary (review, declaration, submission),
  // unknown (not handled), loading (markers not ready). A `problem` instead means: stop with that reason.

  function staticScreen(request) {
    const { steps, boundaries = [] } = request.config;
    const step = steps.find((candidate) => candidate.path === location.pathname);
    if (step) return { role: "step", id: step.id, label: step.label };
    if (boundaries.some((pattern) => new RegExp(pattern).test(location.pathname))) return { role: "boundary" };
    return { role: "unknown" };
  }

  // Recognised safe section links of the checklist, in page order. Anything else is ignored: the
  // Signature link, help and exit are never opened.
  function checklistLinks(request) {
    const { hub, steps, bind } = request.config;
    return [...document.querySelectorAll(hub.links)].flatMap((anchor) => {
      let url;
      try { url = new URL(anchor.href); } catch { return []; }
      const step = url.origin === request.origin && steps.find((candidate) => candidate.path === url.pathname);
      return step ? [{ anchor, step, application: url.searchParams.get(bind.field) || "" }] : [];
    });
  }

  function checklistScreen(request) {
    const { hub, steps, bind } = request.config;
    const binding = boundValue(document, bind.field);
    const onHub = location.pathname === hub.path;
    if (!onHub && !steps.some((candidate) => candidate.path === location.pathname)) return { role: "unknown" };
    if (!binding) return { problem: "The portal does not show which application this page belongs to, so Fill all stopped." };
    if (request.bind && binding !== request.bind) return { problem: OTHER_APPLICATION };
    if (!onHub) {
      const step = steps.find((candidate) => candidate.path === location.pathname);
      return { role: "step", id: step.id, label: step.label, binding };
    }
    const links = checklistLinks(request);
    if (links.some((link) => link.application !== binding)) {
      return { problem: "A checklist section belongs to a different application, so Fill all stopped before opening anything." };
    }
    const next = links.find((link) => !request.visited.includes(link.step.id));
    return { role: "hub", id: "hub", label: "Application checklist", binding, next: next ? { id: next.step.id, label: next.step.label } : null };
  }

  function genericScreen() {
    const path = location.pathname;
    if (BLOCKED_ROUTE.test(path)) return { role: "boundary", reason: "This page looks like a submission, declaration, payment or account page, so Fill all will not use it." };
    if ([...document.querySelectorAll("input[type='password']")].some(visible)) return { role: "unknown", reason: "This page asks for a password, so Fill all will not use it." };
    const forbidden = forbiddenContent(document);
    if (forbidden) return { role: "boundary", reason: forbidden };
    const binding = appRoute(path);
    if (!binding) return { role: "unknown", reason: "This site's address has no application section to bind Fill all to. Continue manually." };
    return { role: "step", id: fingerprint(path), binding };
  }

  // ---- Tabs inside one document ---------------------------------------------------------------------

  const TAB_LINKS = "a[href^='#TAB-']";
  const tabKey = (link) => attr(link, "href").slice("#TAB-".length);
  const tabOf = (link) => link.closest("li, [role='tab']") || link;
  const tabSelected = (link) => {
    const tab = tabOf(link);
    return attr(tab, "aria-selected") === "true" || tab.classList.contains("ui-state-active");
  };
  const tabShown = (link) => {
    const tab = tabOf(link);
    return !tab.hidden && !tab.classList.contains("sv-hidden") && getComputedStyle(tab).display !== "none" && link.getClientRects().length > 0;
  };
  const panelOf = (key) => document.getElementById(`TAB-${key}`);
  const panelOpen = (panel) => Boolean(panel) && !panel.hidden && attr(panel, "aria-hidden") !== "true" && getComputedStyle(panel).display !== "none";

  // The one tab that is both marked selected and showing its panel, or "".
  function activeKey() {
    const open = [...document.querySelectorAll(TAB_LINKS)].filter((link) => tabSelected(link) && panelOpen(panelOf(tabKey(link))));
    return open.length === 1 ? tabKey(open[0]) : "";
  }

  // Visible tabs in page order. Tabs the portal hides for this course are not in it.
  const shownTabs = () => [...new Set([...document.querySelectorAll(TAB_LINKS)].filter(tabShown).map(tabKey))];

  // The next tab Fill all may fill that is not done: it exists and is showing.
  function nextSafe(request, current) {
    const done = [...request.visited, current];
    const shown = shownTabs();
    return request.config.steps.find((step) => !done.includes(step.id) && shown.includes(step.id)) || null;
  }

  function tabScreen(request) {
    const { steps, boundaryTabs = [] } = request.config;
    const active = activeKey();
    if (!active) return { role: "loading" };
    const step = steps.find((candidate) => candidate.id === active);
    if (step) return { role: "step", id: step.id, label: step.label };
    if (boundaryTabs.includes(active)) return { role: "boundary", reason: "The Submission tab is open, so Fill all will not use it." };
    const next = nextSafe(request, "");
    return { role: "hub", id: "hub", label: "Application tabs", next: next ? { id: next.id, label: next.label } : null };
  }

  const SCREENS = {
    "form-post": staticScreen,
    "checklist-link": checklistScreen,
    "same-document-tab": tabScreen,
    "generic-post": genericScreen,
  };
  const tabbed = (request) => request.kind === "same-document-tab";

  function screenOf(request) {
    const screen = SCREENS[request.kind];
    return screen ? screen(request) : { problem: "This portal adapter is not supported." };
  }

  // Trusted input in the portal page means staff are using it. Fill all's own clicks are untrusted, so
  // this tells the two apart without watching the page's network or hooking its scripts. Only the time of
  // the latest trusted input is kept: a run is stopped by input at or after its own start, so staff
  // acting between runs on the same document (to fix a validation error, say) never poison the next one.
  const state = { listening: false, staffAt: 0, runId: "", runStartedAt: 0, watch: null };
  function listenForStaff() {
    if (state.listening) return;
    state.listening = true;
    for (const type of ["pointerdown", "mousedown", "click", "keydown", "touchstart", "paste", "cut", "drop"]) {
      window.addEventListener(type, (event) => { if (event.isTrusted) state.staffAt = Date.now(); }, true);
    }
  }

  // Every operation starts here. It checks the document, adopts the run that is asking (a new run
  // starts with no watch carried over, and an operation of an older run is refused rather than allowed to
  // rewind a newer one), and stops when staff have used the page during this run.
  function enter(request) {
    const problem = contextProblem(request);
    if (problem) return problem;
    listenForStaff();
    if (!request.runId || !Number.isFinite(request.runStartedAt)) return WRONG_PAGE;
    if (request.runStartedAt < state.runStartedAt) return STALE_RUN;
    if (request.runId !== state.runId) {
      endWatch();
      state.runId = request.runId;
      state.runStartedAt = request.runStartedAt;
    }
    return state.staffAt >= state.runStartedAt ? STAFF_TOUCHED : "";
  }

  // Whether the screen being filled is still loading: the root, an ancestor or a visible descendant is
  // aria-busy. Hidden panels and forms are not the screen, so their state is ignored.
  const BUSY = "[aria-busy='true']";
  function busy(root) {
    const top = root === document ? document.body : root;
    if (!top) return true;
    return Boolean(Element.prototype.closest.call(top, BUSY)) || [...within(top, BUSY)].some(visible);
  }

  // ---- Saving through a native POST form ------------------------------------------------------------

  // Where the browser would send this form: the button's formaction, else the form's action. Empty or
  // absent means this document's URL. Anything else is resolved by the platform against document.baseURI,
  // so a <base href> on the page moves the target exactly as it would for the real submission.
  function effectiveAction(button, form) {
    const submitter = has(button, "formaction");
    const raw = submitter ? attr(button, "formaction") : attr(form, "action");
    if (raw === null || raw.trim() === "") return new URL(location.href);
    const resolve = submitter ? (button instanceof HTMLButtonElement ? buttonAction : inputAction) : formAction;
    return new URL(resolve.call(submitter ? button : form));
  }

  // Whether the save may post to this action, by what the adapter knows of its destinations.
  function actionProblem(request, action, form) {
    if (action.origin !== request.origin) return OFF_LIMITS;
    if (request.kind === "form-post") {
      return request.config.steps.some((step) => step.path === action.pathname) ? "" : OFF_LIMITS;
    }
    if (request.kind === "checklist-link") {
      // Section pages post to their own processing page: P_DispAppName posts to P_ProcAppName, never to Signature.
      const expected = request.path.replace(/\.P_Disp(?=[^./]*$)/, ".P_Proc");
      if (expected === request.path || action.pathname !== expected) return OFF_LIMITS;
      const field = request.config.bind.field;
      const own = boundValue(form, field);
      return own && own === boundValue(document, field) && (!request.bind || own === request.bind) ? "" : OTHER_APPLICATION;
    }
    if (BLOCKED_ROUTE.test(action.pathname)) return "The form would save to a submission, declaration, payment or account page, so Fill all will not use it.";
    const route = appRoute(location.pathname);
    if (!route || appRoute(action.pathname) !== route) return "The form would save outside this application, so Fill all will not use it.";
    if (action.search && action.search !== location.search) return OFF_LIMITS;
    return !request.bind || request.bind === route ? "" : OTHER_APPLICATION;
  }

  const isSubmitter = (control) => {
    const type = (attr(control, "type") || "").trim().toLowerCase();
    if (control instanceof HTMLInputElement) return type === "submit";
    return control instanceof HTMLButtonElement && (type === "" || type === "submit");
  };

  // The one exact save control of this screen and the form it submits, or why not. The submission must
  // be a same-window POST to a destination the adapter accepts, with the button's own
  // formmethod/formaction/formtarget overrides applied. `soft` problems (no or several matching
  // buttons) can still resolve while a page loads; every other problem is a target that is unsafe now.
  function locateSave(request) {
    const pattern = new RegExp(request.config.save.text, "i");
    const matches = [...document.querySelectorAll(request.config.save.controls)]
      .filter((control) => !control.disabled && visible(control) && isSubmitter(control) && pattern.test(controlText(control)));
    if (matches.length !== 1) {
      return { soft: true, problem: matches.length ? "This page has more than one Save and continue button." : "This page has no Save and continue button." };
    }
    const button = matches[0];
    const form = button.form;
    if (!form) return { problem: "The Save and continue button does not post a form." };

    const method = String(has(button, "formmethod") ? attr(button, "formmethod") : attr(form, "method") || "").trim().toLowerCase();
    if (method !== "post") return { problem: "The Save and continue button does not post a form." };

    const base = document.querySelector("base[target]");
    const target = [attr(button, "formtarget"), attr(form, "target"), base && attr(base, "target")]
      .find((value) => value !== null && value !== undefined && value.trim() !== "");
    if (target && target.trim().toLowerCase() !== "_self") return { problem: "The form would save in another window or frame." };

    let action;
    try {
      action = effectiveAction(button, form);
    } catch {
      return { problem: "The form action could not be read." };
    }
    const refusal = actionProblem(request, action, form);
    return refusal ? { problem: refusal } : { button, form };
  }

  // Native required/pattern validity plus the portal's own marked errors, within the form or panel
  // that is being saved. A failure never submits.
  function validationProblem(scope) {
    const controls = scope instanceof HTMLFormElement ? [...formElements.call(scope)] : [...within(scope, "input, select, textarea")];
    const invalid = controls.filter((element) => element.willValidate && !element.checkValidity());
    if (invalid.length) {
      return `Answer these manually, then run Fill all again: ${invalid.slice(0, MAX_LABELS).map(fieldLabel).join(", ")}.`;
    }
    if (within(scope, "[aria-invalid='true'], .errorlist").length) return "The portal shows validation messages. Fix them manually.";
    return "";
  }

  // A navigating screen the request may act on now, or the reason it may not. The worker pins the
  // exact document and path, so only the role is rechecked: a screen's id may change as fields it
  // filled reveal others, which must not strand a save.
  function navGuard(request) {
    const problem = enter(request);
    if (problem) return { problem };
    const screen = screenOf(request);
    if (screen.problem) return { problem: screen.problem };
    if (screen.role !== "step") return { problem: screen.reason || WRONG_PAGE };
    const forbidden = request.kind === "generic-post" ? "" : forbiddenContent(document);
    return forbidden ? { problem: forbidden } : { screen };
  }

  function navInspect(request) {
    const screen = screenOf(request);
    if (screen.problem) return { problem: screen.problem };
    if (screen.role !== "step") return { screen, ready: true, fields: 0 };
    const forbidden = request.kind === "generic-post" ? "" : forbiddenContent(document);
    if (forbidden) return { screen, problem: forbidden };
    const located = locateSave(request);
    if (located.problem && !located.soft) return { screen, problem: located.problem };
    const fields = SAMS_ENGINE.scanFormFields({ mode: "fill" }).length;
    return { screen, ready: !busy(located.form || document), fields, soft: located.problem || (fields ? "" : NOTHING_TO_FILL) };
  }

  // ---- Saving a tab of one document -----------------------------------------------------------------

  // Messages the portal writes after a save. Observed from the DOM only: no page script is hooked.
  const MESSAGE = "[role='status'], [role='alert'], [aria-live], .alert, .message, .notice, .notification, .toast, .success, .error, .ui-state-highlight, .ui-state-error";
  const SAVED_TEXT = /\b(?:saved|save successful)\b/i;
  const FAILED_TEXT = /\b(?:error|errors|fail|failed|failure|could not|couldn't|unable|unsuccessful|invalid|not saved|try again)\b/i;

  // A message is a notice, not a wrapper: an aria-live region around form fields or a tab panel is not
  // one, so edits to the form never read as the portal speaking.
  const isMessage = (element) => !element.querySelector("input, select, textarea, [role='tabpanel']");
  const messageOf = (node) => {
    const start = node instanceof Element ? node : node && node.parentElement;
    for (let found = start && start.closest(MESSAGE); found; found = found.parentElement && found.parentElement.closest(MESSAGE)) {
      if (isMessage(found)) return found;
    }
    return null;
  };
  const messages = () => [...document.querySelectorAll(MESSAGE)].filter((element) => isMessage(element) && visible(element) && normalize(element.textContent));
  const failure = (element) => {
    const text = normalize(element.textContent);
    return FAILED_TEXT.test(text) || (element.matches("[role='alert'], .error, .ui-state-error, .alert-danger") && !SAVED_TEXT.test(text));
  };

  function tabButtons(request) {
    const pick = (selector) => {
      const found = [...document.querySelectorAll(selector)].filter((control) => visible(control) && !control.disabled);
      return found.length === 1 && !FORBIDDEN_CONTROL.test(controlText(found[0])) ? found[0] : null;
    };
    return { next: pick(request.config.save.next), only: pick(request.config.save.only) };
  }

  function tabGuard(request) {
    const problem = enter(request);
    if (problem) return { problem };
    const screen = tabScreen(request);
    if (screen.role !== "step" || (request.target && screen.id !== request.target)) return { problem: WRONG_PAGE };
    const panel = panelOf(screen.id);
    if (busy(panel)) return { problem: STILL_LOADING };
    const forbidden = forbiddenContent(panel);
    return forbidden ? { problem: forbidden } : { screen, panel };
  }

  // Starts watching for the portal's reaction to a click that is about to happen. A message counts as
  // fresh only if its own text or children were written after this point (or it was hidden and has been
  // shown), so an earlier "saved" is stale. Attribute changes elsewhere, such as a button being disabled
  // or a tab switching, are never an acknowledgement.
  function beginWatch(active) {
    endWatch();
    const touched = new Set();
    const shown = new Set(messages());
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          if (["hidden", "style", "class"].includes(record.attributeName) && record.target.matches(MESSAGE)
            && isMessage(record.target) && !shown.has(record.target)) touched.add(record.target);
          continue;
        }
        const message = messageOf(record.target);
        if (message) touched.add(message);
        for (const added of record.addedNodes) {
          if (!(added instanceof Element)) continue;
          const holder = messageOf(added);
          if (holder) touched.add(holder);
          added.querySelectorAll(MESSAGE).forEach((inner) => { if (isMessage(inner)) touched.add(inner); });
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
    state.watch = { observer, touched, started: active };
  }

  function endWatch() {
    if (state.watch) state.watch.observer.disconnect();
    state.watch = null;
  }

  function tabInspect(request) {
    const screen = tabScreen(request);
    if (screen.role !== "step") return { screen, ready: screen.role !== "loading", fields: 0 };
    const panel = panelOf(screen.id);
    const forbidden = forbiddenContent(panel);
    if (forbidden) return { screen, problem: forbidden };
    const body = document.getElementById(`TAB-MAIN-${screen.id}`);
    const fields = body ? SAMS_ENGINE.scanFormFields({ mode: "fill" }).filter((field) => body.contains(field.element)).length : 0;
    const buttons = tabButtons(request);
    const soft = !buttons.only ? "This tab has no single Save button." : fields ? "" : NOTHING_TO_FILL;
    return { screen, ready: Boolean(body) && !busy(panel), fields, soft };
  }

  // True when a message written after the click now reads as a plain success.
  function acknowledged(watch) {
    return [...watch.touched].some((message) => message.isConnected && visible(message)
      && SAVED_TEXT.test(normalize(message.textContent)) && !FAILED_TEXT.test(normalize(message.textContent)));
  }

  globalThis.SAMS_FILL_ALL_PAGE = {
    // Which screen is this, has it finished loading, and may Fill all act on it? `fields` lets the
    // worker wait until lazy content stops changing; `soft` is a problem that may still resolve.
    inspect(request) {
      const problem = enter(request);
      if (problem) return { problem };
      if (document.readyState !== "complete") return { ready: false, fields: 0, screen: { role: "loading" } };
      return tabbed(request) ? tabInspect(request) : navInspect(request);
    },

    // The engine fills only empty fields and never clicks. Counts only: no values leave the page.
    async fill(request) {
      const guard = tabbed(request) ? tabGuard(request) : navGuard(request);
      if (guard.problem) return guard;
      let fields = SAMS_ENGINE.scanFormFields({ mode: "fill" });
      // Split dates are written only inside the same scope as the other fields.
      let scope;
      if (tabbed(request)) {
        const body = document.getElementById(`TAB-MAIN-${guard.screen.id}`);
        if (!body) return { problem: WRONG_PAGE };
        scope = body;
        fields = fields.filter((field) => body.contains(field.element));
      } else {
        const located = locateSave(request);
        if (located.problem && !located.soft) return { problem: located.problem };
        // Only the form that Save and continue submits is filled. Without one there is nothing safe to write to.
        if (!located.form) return { problem: located.problem };
        if (busy(located.form)) return { problem: STILL_LOADING };
        scope = located.form;
        fields = fields.filter((field) => Node.prototype.contains.call(located.form, field.element));
      }
      const report = await SAMS_ENGINE.autofillPage(request.fieldMap || {}, fields, scope);
      if (!report.mapping && request.kind !== "generic-post") return { problem: "This page has no saved portal mapping, so Fill all will not save it." };
      if (request.kind === "generic-post" && !report.filled.length && !(report.skippedExisting || []).length) return { problem: NOTHING_TO_FILL };
      return { filled: report.filled.length, manual: (report.manualReview || []).length };
    },

    // Validates, then clicks the one exact draft-save control. The click is the only page action.
    save(request) {
      const guard = tabbed(request) ? tabGuard(request) : navGuard(request);
      if (guard.problem) return guard;
      if (!tabbed(request)) {
        const located = locateSave(request);
        if (located.problem) return { problem: located.problem };
        if (busy(located.form)) return { problem: STILL_LOADING };
        const invalid = validationProblem(located.form);
        if (invalid) return { problem: invalid };
        located.button.click();
        return { clicked: true };
      }

      const invalid = validationProblem(guard.panel);
      if (invalid) return { problem: invalid };
      if (messages().some(failure)) return { problem: "The portal shows an error message. Fix it manually." };
      const active = guard.screen.id;
      const order = shownTabs();
      const following = order[order.indexOf(active) + 1] || "";
      // Save and Continue only when the portal's next tab is one Fill all will fill. Otherwise a
      // Save-only keeps the portal from walking into a tab Fill all must not enter, such as Submission.
      const advance = Boolean(following) && request.config.steps.some((step) => step.id === following) && !request.visited.includes(following);
      const buttons = tabButtons(request);
      const button = advance ? buttons.next : buttons.only;
      if (!button) return { problem: "This tab does not show exactly one Save control." };
      beginWatch(active);
      button.click();
      const after = advance ? null : nextSafe(request, active);
      return { clicked: true, mode: advance ? "continue" : "save", expect: advance ? following : "", after: after ? after.id : "" };
    },

    // Moves to the next screen without saving: opens the next recognised checklist section, or the
    // next fillable tab. Only a target the adapter lists can be opened.
    follow(request) {
      const problem = enter(request);
      if (problem) return { problem };
      if (tabbed(request)) {
        const link = request.config.steps.some((step) => step.id === request.target) && !request.visited.includes(request.target)
          ? document.querySelector(`a[href='#TAB-${request.target}']`) : null;
        if (!link || !tabShown(link) || activeKey() === request.target) return { problem: WRONG_PAGE };
        link.click();
        return { clicked: true };
      }
      const screen = screenOf(request);
      if (screen.problem) return { problem: screen.problem };
      if (screen.role !== "hub" || !screen.next || screen.next.id !== request.target) return { problem: WRONG_PAGE };
      const link = checklistLinks(request).find((candidate) => candidate.step.id === request.target);
      if (!link) return { problem: WRONG_PAGE };
      link.anchor.click();
      return { clicked: true };
    },

    // Tabs only: has the portal acknowledged the last click? `done` only for a fresh success message
    // written after the click, never for a tab change or idle buttons alone: without a message that
    // can be proved fresh the worker times out and stops. An error message, staff input or an
    // unexpected tab stops the run instead.
    observe(request) {
      const problem = enter(request);
      if (problem) return { problem };
      if (messages().some(failure)) return { problem: "The portal showed an error message instead of confirming the save. Check the portal: Fill all will not retry." };
      const active = activeKey();
      if (request.mode === "enter") return { done: active === request.expect };
      const idle = ![...document.querySelectorAll(`${request.config.save.next}, ${request.config.save.only}`)].some((control) => control.disabled);
      const watch = state.watch;
      if (!watch) return { problem: WRONG_PAGE };
      if (request.mode === "continue") {
        if (active && active !== watch.started && active !== request.expect) return { problem: "The portal opened a different tab than expected. Check the portal." };
        if (active === request.expect && idle && acknowledged(watch)) { endWatch(); return { done: true }; }
        return { done: false };
      }
      if (acknowledged(watch) && idle) { endWatch(); return { done: true }; }
      return { done: false };
    },
  };

  // Listening from injection, so input between injection and the run's first request is still seen.
  listenForStaff();
}
