// Optional fill-all run, owned by the worker so closing the popup does not cancel it. One run exists
// at a time, bound to one tab, origin, exact document and exact copied student. The run record holds
// progress only: student fields stay in the session cache and are read again before every mutation.
//
// One orchestrator drives every portal. An adapter descriptor says how the portal moves on:
//   form-post          native POST form per screen, screens listed by path (Bangor)
//   checklist-link     a checklist of GET links to native POST sections of one application (Greenwich)
//   same-document-tab  lazy tabs in one document saved by script-driven buttons (Greater Manchester)
//   generic-post       an unmapped site with one explicit Save and continue (activeTab access only)
// Navigation kinds confirm a save by a new document that committed as our own form submission; the tab
// kind confirms it by a fresh transition or saved message observed in the page.
(() => {
  const RUN_KEY = "fillAllRun";
  const ACTIONS = ["startFillAll", "getFillAllStatus", "stopFillAll"];
  const MAX_RUN_MS = 10 * 60 * 1000;
  const READY_MS = 20000;
  const NAVIGATE_MS = 20000;
  const POLL_MS = 300;
  // Polls a screen may stay ready with a problem that could still resolve before it is a stop.
  const SOFT_POLLS = 4;
  // Files injected into the selected portal document, relative to the extension root.
  const PAGE_FILES = [
    "config/build-mode.js",
    "config/allowlist.js",
    "config/synonyms.js",
    "config/portals/greenwich.js",
    "config/portals/manchester.js",
    "config/portals/bangor.js",
    "src/engine/engine.js",
    "src/fill-all-page.js",
  ];
  // An unmapped site has no saved screens: the one control is matched by its exact text, and each
  // screen is judged from its own page.
  const GENERIC = {
    kind: "generic-post",
    config: { save: { controls: "button, input[type='submit']", text: "^save\\s*(?:and|&)\\s*continue$" } },
    maxSteps: 12,
  };
  const BOUNDARY_DONE = "Reached the review and declaration stage. Fill all stopped before it: review every screen and submit it yourself.";

  // A run ends with this: "stopped" for a safe refusal or staff choice, "failed" for an error.
  class RunEnd extends Error {
    constructor(status, reason) {
      super(reason);
      this.status = status;
    }
  }
  const stop = (reason) => new RunEnd("stopped", reason);

  let deps = null;
  let chain = Promise.resolve();
  // The run this worker lifetime is driving. A stored "running" record without it is an orphan.
  let live = null;
  // True only when install registered every navigation listener. Checked at start, not re-detected,
  // because a browser can expose the API later than the listeners could have been attached.
  let monitored = false;

  // Every read-modify-write of the run record, and every start, goes through this chain.
  function serialized(operation) {
    const result = chain.then(operation);
    chain = result.catch(() => {});
    return result;
  }

  // Fill all judges every navigation from these events and reads frames through getAllFrames. Some
  // browsers (Safari) lack part of this API; without all of it a run cannot be monitored safely.
  const NAVIGATION_EVENTS = ["onCommitted", "onHistoryStateUpdated", "onCompleted"];
  function hasNavigationSupport() {
    const nav = chrome.webNavigation;
    return Boolean(nav) && typeof nav.getAllFrames === "function"
      && NAVIGATION_EVENTS.every((name) => nav[name] && typeof nav[name].addListener === "function");
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const originOf = (url) => { try { return new URL(url).origin; } catch { return ""; } };
  const pathOf = (url) => { try { return new URL(url).pathname; } catch { return ""; } };

  async function loadRun() {
    const stored = await chrome.storage.session.get(RUN_KEY);
    return stored[RUN_KEY] || null;
  }

  function publicRun(run) {
    if (!run) return null;
    const { id, status, phase, step, visited, counts, reason, portalName, startedAt, updatedAt, endedAt } = run;
    return { id, status, phase, step, visited, counts, reason, portalName, startedAt, updatedAt, endedAt };
  }

  // Changes a run only while it is still running, so a stop, Clear or earlier ending is never overwritten.
  function update(runId, change) {
    return serialized(async () => {
      const run = await loadRun();
      if (!run || run.id !== runId || run.status !== "running") return null;
      change(run);
      run.updatedAt = Date.now();
      await chrome.storage.session.set({ [RUN_KEY]: run });
      return run;
    });
  }

  // `unclicked` is for a refusal the page acknowledged before clicking anything.
  function end(runId, status, reason, unclicked = false) {
    return update(runId, (run) => {
      // After a click the portal may have saved even though we stopped before seeing the result, and a
      // fill already dispatched to the page cannot be recalled.
      const unfinished = status !== "completed";
      const saving = unfinished && !unclicked && (run.phase === "saving" || run.phase === "confirming");
      const filling = unfinished && run.phase === "filling";
      run.status = status;
      run.reason = saving ? `${reason} A save may already have completed: check the portal.`
        : filling ? `${reason} Some fields may already have been filled: check the portal.`
        : reason;
      run.phase = "ended";
      run.endedAt = Date.now();
    });
  }

  // Ends the driven run now, even while its loop is mid-wait: the loop sees `halt` at its next check.
  function haltLive(reason) {
    if (!live || live.halt) return;
    live.halt = reason;
    end(live.id, "stopped", reason).catch(() => {});
  }

  function guard(run) {
    if (!live || live.id !== run.id) throw stop("Fill all was stopped.");
    if (live.halt) throw stop(live.halt);
    if (Date.now() - run.startedAt > MAX_RUN_MS) throw stop("Fill all reached its 10 minute limit. Continue manually.");
  }

  // Adapter descriptor for an origin: a mapped portal's saved config, or the generic one. `unsupported`
  // names a mapped portal whose navigation has not been verified.
  function portalFor(origin) {
    return (globalThis.SAMS_PORTALS || []).find((portal) => (portal.origins || []).includes(origin)) || null;
  }

  function adapterFor(origin) {
    const portal = portalFor(origin);
    if (!portal) return { ...GENERIC, portalId: "unmapped", portalName: new URL(origin).hostname };
    const config = portal.fillAll;
    if (!config) return { unsupported: portal.name };
    return { kind: config.kind || "form-post", config, portalId: portal.id, portalName: portal.name, maxSteps: 40 };
  }

  // The screens an adapter lists, for the message shown when Fill all is started somewhere else.
  function startProblem(adapter, path) {
    const { kind, config } = adapter;
    if (kind === "generic-post") return "";
    const here = kind === "same-document-tab" ? config.path === path
      : config.steps.some((step) => step.path === path) || (config.hub && config.hub.path === path);
    if (here) return "";
    const labels = config.steps.map((step) => step.label).join(", ");
    return kind === "same-document-tab" ? `Open the application form first, then start Fill all. It fills these tabs: ${labels}.`
      : kind === "checklist-link" ? `Open the application checklist or one of its sections first: ${labels}.`
      : `Open one of the supported screens first: ${labels}.`;
  }

  // Everything that must still hold immediately before the page is touched: not halted, in time, the
  // tab still on this portal (and this exact document when given), and the same copied student.
  async function verify(run, documentId) {
    guard(run);
    let frames;
    try {
      frames = (await chrome.webNavigation.getAllFrames({ tabId: run.tabId })) || [];
    } catch {
      throw stop("The portal tab was closed.");
    }
    const top = frames.find((frame) => frame.frameId === 0);
    if (!top || originOf(top.url) !== run.origin) throw stop("The tab left the portal. Fill all stopped.");
    if (documentId && top.documentId !== documentId) throw stop("The page changed while Fill all was running.");
    const cache = await deps.readCache();
    if (!cache) throw stop("The copied student was cleared or expired.");
    if (cache.studentId !== run.student.studentId || cache.copiedAt !== run.student.copiedAt) {
      throw stop("A different student was copied. Fill all stopped.");
    }
    guard(run);
    return { top, cache };
  }

  // Runs one page-agent operation in this exact document. A document that is gone rejects here.
  // `arm` names the navigation this operation is about to cause (our own click), so the listeners can
  // tell it from staff navigating the tab.
  async function callPage(run, documentId, operation, request, arm = "") {
    // Nothing is dispatched to the page once the run is halted, however long the awaits before this took.
    guard(run);
    // Armed with no await before the dispatch, so a navigation this click causes is recognised by the
    // listeners even if its commit beats the script's reply.
    if (arm) live.nav = { transition: arm, documentId: "", loaded: false };
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: run.tabId, documentIds: [documentId] },
        func: (name, input) => (globalThis.SAMS_FILL_ALL_PAGE
          ? globalThis.SAMS_FILL_ALL_PAGE[name](input)
          : { problem: "The portal page agent is not loaded." }),
        args: [operation, request],
      });
    } catch {
      throw stop("The portal page changed or could not be reached.");
    }
    const result = results && results[0] && results[0].result;
    if (!result) throw stop("The portal page did not respond.");
    return result;
  }

  // A page operation with the request built from this run's current state and the document's own URL.
  async function ask(run, adapter, documentId, operation, extra = {}, options = {}) {
    const { top, cache } = await verify(run, documentId);
    const request = {
      origin: run.origin, path: pathOf(top.url), kind: adapter.kind, config: adapter.config,
      visited: [...live.visited], bind: live.bind, runId: run.id, runStartedAt: run.startedAt, ...extra,
    };
    if (options.fields) request.fieldMap = cache.fields;
    return callPage(run, documentId, operation, request, options.arm);
  }

  async function inject(run, documentId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: run.tabId, documentIds: [documentId] }, files: PAGE_FILES });
    } catch {
      throw new RunEnd("failed", "Could not run on this page. Allow SAMS Portal Autofill to access this website and try again.");
    }
  }

  // Waits until the page names what the document is (not "loading"). A `problem` is returned, not
  // thrown, so the caller can still record a save whose result document was recognised.
  async function settle(run, adapter, documentId) {
    const deadline = Date.now() + READY_MS;
    while (Date.now() < deadline) {
      const state = await ask(run, adapter, documentId, "inspect");
      if (state.problem || !state.screen || state.screen.role !== "loading") return state;
      await sleep(POLL_MS);
    }
    throw stop("The portal page did not finish loading. Continue manually.");
  }

  // Waits for a data-entry screen to stop changing: ready twice in a row with the same field count, so
  // lazy content has stopped arriving. A problem that persists while ready is a stop, not a wait.
  async function stabilize(run, adapter, documentId) {
    const deadline = Date.now() + READY_MS;
    let previous = -1;
    let soft = 0;
    while (Date.now() < deadline) {
      const state = await ask(run, adapter, documentId, "inspect");
      if (state.problem) throw stop(state.problem);
      if (!state.screen || state.screen.role !== "step") throw stop("The portal page changed while Fill all was running.");
      if (state.ready && state.fields === previous) {
        if (!state.soft) return state;
        if (++soft >= SOFT_POLLS) throw stop(state.soft);
      } else soft = 0;
      previous = state.ready ? state.fields : -1;
      await sleep(POLL_MS);
    }
    throw stop("The portal page did not finish loading. Continue manually.");
  }

  // Top-frame navigation is judged from webNavigation events, not from a changed document id: a
  // document is our continuation only when it committed as the navigation `live.nav` was armed for by our
  // own click (a form submission for a save, a link for opening a checklist section). Any other new
  // document (typed address, link, reload, back/forward, script redirect) ends the run. Staff clicking
  // the portal's own control at the same moment cannot be told apart from our click: the run still
  // stops if the result is unsupported.
  const NAV_QUALIFIERS = ["server_redirect"];

  function ownTopFrame(details) {
    return Boolean(live) && !live.halt && details.tabId === live.tabId && details.frameId === 0
      && (!details.documentLifecycle || details.documentLifecycle === "active");
  }

  function onTopCommitted(details) {
    if (!ownTopFrame(details)) return;
    if (details.documentId && details.documentId === live.documentId) return;
    const nav = live.nav;
    const genuine = Boolean(nav) && !nav.documentId
      && details.transitionType === nav.transition
      && (details.transitionQualifiers || []).every((qualifier) => NAV_QUALIFIERS.includes(qualifier))
      && originOf(details.url) === live.origin;
    if (genuine) nav.documentId = details.documentId || "";
    else {
      const kind = [details.transitionType, ...(details.transitionQualifiers || [])].filter(Boolean).join("+") || "unknown";
      haltLive(`The tab navigated by a route other than Fill all's own click (${kind}). Fill all stopped.`);
    }
  }

  // Same-document URL changes (the portal's own history updates) are fine on the documents the run
  // owns; a history update on any other document in the tab is not ours.
  function onTopHistory(details) {
    if (!ownTopFrame(details)) return;
    const owned = [live.documentId, live.nav && live.nav.documentId];
    if (details.documentId && !owned.includes(details.documentId)) {
      haltLive("The portal page changed while Fill all was running. Fill all stopped.");
    }
  }

  function onTopCompleted(details) {
    if (!ownTopFrame(details)) return;
    if (live.nav && live.nav.documentId && details.documentId === live.nav.documentId) live.nav.loaded = true;
  }

  // After our click, waits for the navigation it armed to commit a new document and finish loading,
  // then returns that document's top frame.
  async function waitForNavigation(run, what) {
    const deadline = Date.now() + NAVIGATE_MS;
    while (Date.now() < deadline) {
      guard(run);
      const nav = live.nav;
      if (nav && nav.documentId && nav.loaded) return (await verify(run, nav.documentId)).top;
      await sleep(POLL_MS);
    }
    guard(run);
    if (live.nav && live.nav.documentId) throw stop(`The portal did not finish loading after ${what}. Check the portal: Fill all will not retry.`);
    throw stop(`${what} did not leave the page. Check the portal for messages: Fill all will not retry.`);
  }

  // Tabs: polls the page until it reports the portal's fresh reaction to our click, or gives up.
  async function waitForTab(run, adapter, documentId, request) {
    const deadline = Date.now() + NAVIGATE_MS;
    for (;;) {
      const seen = await ask(run, adapter, documentId, "observe", request);
      if (seen.problem) throw stop(seen.problem);
      if (seen.done) return;
      if (Date.now() >= deadline) break;
      await sleep(POLL_MS);
    }
    throw stop(request.mode === "enter" ? "The portal did not open the next tab. Continue manually."
      : "The portal did not confirm that the draft was saved. Check the portal: Fill all will not retry.");
  }

  async function drive(initial, adapter) {
    let run = initial;
    let documentId = run.documentId;
    let injected = "";
    // A save was confirmed and its result document is being recognised; counted once it is.
    let afterSave = false;
    const tabs = adapter.kind === "same-document-tab";
    // Moves the stored run forward, or stops this loop when it already ended (staff Stop, Clear, restart).
    const advance = async (change) => {
      const next = await update(run.id, change);
      if (!next) throw stop("Fill all was stopped.");
      run = next;
    };
    // Records the document reached by a link or confirmed save as ours.
    const arrived = (top) => {
      documentId = top.documentId;
      live.documentId = documentId;
      live.nav = null;
    };
    try {
      for (;;) {
        await verify(run, documentId);
        if (injected !== documentId) {
          await inject(run, documentId);
          injected = documentId;
        }
        await advance((draft) => {
          draft.phase = "waiting";
          draft.documentId = documentId;
        });
        const first = await settle(run, adapter, documentId);
        const seen = first.screen;
        const counted = afterSave;
        afterSave = false;

        // The application never changes mid-run: the first screen binds it, every later one must match.
        if (seen && seen.binding !== undefined) {
          if (live.bind && seen.binding !== live.bind) throw stop("The portal opened a different application. Fill all stopped.");
          live.bind = seen.binding;
        }
        if (counted && seen && seen.role === "boundary") {
          await advance((draft) => { draft.counts.saved += 1; });
          await end(run.id, "completed", BOUNDARY_DONE);
          return;
        }
        if (counted && seen && (seen.role === "hub" || (seen.role === "step" && !live.visited.has(seen.id)))) {
          await advance((draft) => { draft.counts.saved += 1; });
        }
        if (first.problem) throw stop(first.problem);
        if (!seen) throw stop("The portal page did not respond.");
        if (seen.role === "boundary") throw stop(seen.reason || "This screen is a review, declaration or submission stage, so Fill all will not use it.");
        if (seen.role === "unknown") {
          const top = (await verify(run, documentId)).top;
          throw stop(seen.reason || `The portal opened a screen Fill all does not handle (${pathOf(top.url).slice(0, 80)}). Check the portal and continue manually.`);
        }
        if (seen.role === "step" && live.visited.has(seen.id)) {
          throw stop("The portal returned to a screen already handled. Check its messages: Fill all will not retry a save.");
        }

        if (seen.role === "hub") {
          if (!seen.next) {
            const saved = run.counts.saved;
            await end(run.id, saved ? "completed" : "stopped", saved
              ? "Every supported section is saved. Fill all stopped on the checklist: review each section and complete the application yourself."
              : "There is no supported section to fill here. Continue manually.");
            return;
          }
          await advance((draft) => {
            draft.phase = "following";
            draft.step = { id: seen.id, label: seen.label };
          });
          const target = seen.next.id;
          const opened = await ask(run, adapter, documentId, "follow", { target }, { arm: tabs ? "" : "link" });
          if (opened.problem) {
            live.nav = null;
            await end(run.id, "stopped", opened.problem, true);
            return;
          }
          if (tabs) await waitForTab(run, adapter, documentId, { mode: "enter", expect: target });
          else arrived(await waitForNavigation(run, "Opening the next screen"));
          continue;
        }

        const state = await stabilize(run, adapter, documentId);
        const step = state.screen;
        if (live.visited.has(step.id)) throw stop("The portal returned to a screen already handled. Check its messages: Fill all will not retry a save.");
        if (live.visited.size >= adapter.maxSteps) throw stop("Fill all reached its step limit. Continue manually.");
        const label = step.label || `Screen ${live.visited.size + 1}`;

        await advance((draft) => {
          draft.phase = "filling";
          draft.step = { id: step.id, label };
        });
        // The cache is read again inside `ask`, so the values filled are the exact copy this run started with.
        const report = await ask(run, adapter, documentId, "fill", { target: step.id }, { fields: true });
        if (report.problem) throw stop(report.problem);
        await deps.touchCache();
        await advance((draft) => { draft.counts.filled += report.filled; });

        await verify(run, documentId);
        await advance((draft) => {
          draft.phase = "saving";
          draft.visited.push(step.id);
        });
        live.visited.add(step.id);
        guard(run);
        // If the dispatch throws or gets no acknowledgement the run ends: whether the click happened is
        // unknown, and the end reason warns that a save may already have completed.
        const clicked = await ask(run, adapter, documentId, "save", { target: step.id }, { arm: tabs ? "" : "form_submit" });
        if (clicked.problem) {
          // The page refused before clicking, so no save is pending and no warning applies.
          live.nav = null;
          await end(run.id, "stopped", clicked.problem, true);
          return;
        }

        await advance((draft) => { draft.phase = "confirming"; });
        if (!tabs) {
          arrived(await waitForNavigation(run, "Save and continue"));
          afterSave = true;
          continue;
        }
        await waitForTab(run, adapter, documentId, { mode: clicked.mode, expect: clicked.expect });
        await advance((draft) => { draft.counts.saved += 1; });
        if (clicked.mode === "continue") continue;
        if (!clicked.after) {
          await end(run.id, "completed", "Saved the last supported tab. Fill all stopped before Submission: review every tab and submit it yourself.");
          return;
        }
        await advance((draft) => { draft.phase = "following"; });
        const opened = await ask(run, adapter, documentId, "follow", { target: clicked.after });
        if (opened.problem) {
          await end(run.id, "stopped", opened.problem, true);
          return;
        }
        await waitForTab(run, adapter, documentId, { mode: "enter", expect: clicked.after });
      }
    } catch (error) {
      if (error instanceof RunEnd) await end(run.id, error.status, error.message);
      else await end(run.id, "failed", "Fill all hit an unexpected error and stopped.");
    } finally {
      if (live && live.id === run.id) live = null;
    }
  }

  async function startRun(message) {
    if (message.consent !== true) return { error: "Allow Fill all to save drafts before starting." };
    if (!Number.isInteger(message.tabId)) return { error: "Open the application form in this tab first." };
    if (!monitored) return { error: "This browser does not provide the page navigation events Fill all needs to run safely. Use Autofill on each page, or use Chrome or Edge for Fill all." };
    const existing = await loadRun();
    if (existing && existing.status === "running") {
      if (live && live.id === existing.id) {
        return { error: "Fill all is already running. Stop it before starting another run.", run: publicRun(existing) };
      }
      await endOrphan(existing);
    }
    const cache = await deps.readCache();
    if (!cache) return { error: "No copied student is available. Copy from CRM again before Fill all." };
    let frames;
    try {
      frames = (await chrome.webNavigation.getAllFrames({ tabId: message.tabId })) || [];
    } catch {
      return { error: "Open the application form in this tab first." };
    }
    const top = frames.find((frame) => frame.frameId === 0);
    const origin = top ? originOf(top.url) : "";
    if (!top || !SAMS_ALLOWLIST.isFillTarget(origin)) return { error: "Fill all is not supported on this page. Open an application form on a university website." };
    const adapter = adapterFor(origin);
    if (adapter.unsupported) {
      return { error: `Fill all is not supported for ${adapter.unsupported} yet: its save and continue steps have not been verified. Use Autofill on each page.` };
    }
    if (!top.documentId) return { error: "This browser cannot bind Fill all to the exact page document. Fill the form manually, or use Chrome or Edge." };
    const wrongScreen = startProblem(adapter, pathOf(top.url));
    if (wrongScreen) return { error: wrongScreen };
    // Real site access, not a list of origins: a mapped portal has it permanently, any other site only
    // after staff open the extension on that page (activeTab). permissions.contains cannot see that grant.
    try {
      await chrome.scripting.executeScript({ target: { tabId: message.tabId, documentIds: [top.documentId] }, func: () => location.origin });
    } catch {
      return { error: "Fill all cannot access this website yet. Click the SAMS Portal Autofill toolbar button on the application page to give it site access for this tab, then start Fill all again." };
    }

    const now = Date.now();
    const run = {
      id: crypto.randomUUID(),
      status: "running",
      phase: "starting",
      tabId: message.tabId,
      origin,
      portalId: adapter.portalId,
      portalName: adapter.portalName,
      documentId: top.documentId,
      student: { studentId: cache.studentId, copiedAt: cache.copiedAt },
      step: null,
      visited: [],
      counts: { filled: 0, saved: 0 },
      reason: "",
      startedAt: now,
      updatedAt: now,
    };
    await chrome.storage.session.set({ [RUN_KEY]: run });
    // Application binding and step fingerprints live in memory only: a restart never resumes a run.
    live = { id: run.id, tabId: run.tabId, origin, documentId: top.documentId, halt: "", nav: null, bind: "", visited: new Set() };
    drive(run, adapter).catch(() => {});
    return { run: publicRun(run) };
  }

  async function readStatus() {
    const run = await loadRun();
    if (run && run.status === "running" && !(live && live.id === run.id)) {
      const ended = await endOrphan(run);
      return { run: publicRun(ended) };
    }
    return { run: publicRun(run) };
  }

  async function endOrphan(run) {
    run.status = "stopped";
    run.reason = "The extension restarted while Fill all was running. It does not resume on its own: check the portal and start again.";
    run.endedAt = Date.now();
    run.updatedAt = run.endedAt;
    await chrome.storage.session.set({ [RUN_KEY]: run });
    return run;
  }

  // Waits for a start already in the chain, then sets the halt flag the loop checks before every
  // fill and save.
  async function stopRun() {
    await serialized(async () => {});
    if (live && !live.halt) {
      live.halt = "Stopped by staff.";
      await end(live.id, "stopped", live.halt);
    }
    return serialized(readStatus);
  }

  globalThis.SAMS_FILL_ALL = {
    // Called from background.js with its own cache accessors.
    install(accessors) {
      deps = accessors;
      if (chrome.tabs && chrome.tabs.onRemoved) {
        chrome.tabs.onRemoved.addListener((tabId) => { if (live && live.tabId === tabId) haltLive("The portal tab was closed."); });
      }
      // Registered at worker start, as MV3 requires; each handler ignores events unless a run is live.
      // Without the full set, startRun refuses, so no run ever depends on a missing listener.
      monitored = hasNavigationSupport();
      if (monitored) {
        chrome.webNavigation.onCommitted.addListener(onTopCommitted);
        chrome.webNavigation.onHistoryStateUpdated.addListener(onTopHistory);
        chrome.webNavigation.onCompleted.addListener(onTopCompleted);
      }
      // A worker restart cannot resume a run: any stored running record is an orphan.
      serialized(async () => {
        const run = await loadRun();
        if (run && run.status === "running" && !live) await endOrphan(run);
      }).catch(() => {});
    },

    // Copy, Clear and expiry end the run bound to the old copy and drop any finished record for it.
    cacheChanged() {
      if (live) haltLive("The copied student changed or was cleared. Fill all stopped.");
      else serialized(() => chrome.storage.session.remove(RUN_KEY)).catch(() => {});
    },

    // Returns true when the message is a fill-all action; the popup check is the same as for cache actions.
    handle(message, sender, sendResponse) {
      if (!message || !ACTIONS.includes(message.action)) return false;
      if (!SAMS_ALLOWLIST.isPopupSender(sender)) {
        sendResponse({ error: "Fill all actions are only available from the extension popup." });
        return false;
      }
      // Start goes into the chain before any await, so a status read right after it sees the new run.
      let operation;
      if (message.action === "startFillAll") operation = serialized(() => startRun(message));
      else if (message.action === "stopFillAll") operation = stopRun();
      else operation = serialized(readStatus);
      operation.then(sendResponse, (error) => sendResponse({ error: error.message || String(error) }));
      return true;
    },
  };
})();
