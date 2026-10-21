// Popup side of the optional fill-all run. The worker owns the run; this only starts it, shows its
// progress and sends Stop, so closing and reopening the popup never changes a run.
(() => {
  const startButton = document.getElementById("btnFillAll");
  const stopButton = document.getElementById("btnStopFillAll");
  const statusBox = document.getElementById("fillAllStatus");
  const studentCard = document.getElementById("studentCard");
  const PHASES = {
    starting: "Starting",
    waiting: "Waiting for the screen to load",
    filling: "Filling empty fields",
    following: "Opening the next screen",
    saving: "Saving the draft",
    confirming: "Waiting for the portal to confirm the save",
  };
  let run = null;
  let timer = null;
  // A refusal from the worker (unsupported site, no student, run already active), shown until staff retry.
  let notice = "";
  // The newest run this popup has seen. A different one means the notice above is about an older attempt.
  let seenRunId = null;
  // Resolved ahead of the click so Start sends its message in the same task: a popup that closes
  // right after the click must still have started the run.
  let tabId = null;

  const send = (message) => chrome.runtime.sendMessage(message);
  const running = () => Boolean(run && run.status === "running");
  // The student card is hidden exactly when popup.js holds no copied student. The worker checks again.
  const hasStudent = () => !studentCard.hidden;

  async function resolveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab ? tab.id : null;
    } catch {
      tabId = null;
    }
  }

  function show(type, text) {
    statusBox.replaceChildren();
    if (!text) return;
    const item = document.createElement("div");
    item.className = `status ${type}`;
    item.textContent = text;
    statusBox.appendChild(item);
  }

  function plural(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  function describe() {
    if (notice) return show("error", notice);
    if (!run) return show("", "");
    const saved = plural(run.counts.saved, "screen");
    if (running()) {
      const where = run.step ? ` ${run.step.label}.` : "";
      show("info", `Running:${where} ${PHASES[run.phase] || "Working"}. ${saved} saved so far. Stop ends the run before its next fill or save; one already started can still finish. Review the portal afterwards.`);
    } else if (run.status === "completed") {
      show("success", `Supported steps finished: ${saved} saved as drafts. Review needed: the application is not complete or submitted. ${run.reason}`);
    } else if (run.status === "failed") {
      show("error", `Failed. ${run.reason} ${saved} saved as drafts. Review the portal.`);
    } else {
      show("warning", `Stopped. ${run.reason} ${saved} saved as drafts. Review the portal.`);
    }
  }

  function render() {
    startButton.disabled = running() || !hasStudent();
    stopButton.hidden = !running();
    describe();
    clearInterval(timer);
    timer = running() ? setInterval(refresh, 1000) : null;
  }

  async function refresh() {
    try {
      const response = await send({ action: "getFillAllStatus" });
      run = (response && response.run) || null;
    } catch {
      return;
    }
    // A run started elsewhere (the toolbar popup) replaces an earlier refusal; so does one in progress.
    if (run && run.id !== seenRunId) notice = "";
    seenRunId = run ? run.id : null;
    if (running()) notice = "";
    render();
  }

  async function start() {
    startButton.disabled = true;
    notice = "";
    try {
      if (tabId === null) await resolveTab();
      const response = await send({ action: "startFillAll", tabId, consent: true });
      if (response && response.error) {
        notice = response.error;
        if (response.run) run = response.run;
      } else {
        run = response.run;
      }
    } catch {
      notice = "Fill all could not start. Reopen the extension on the application form and try again.";
    }
    render();
  }

  async function stop() {
    stopButton.disabled = true;
    try {
      const response = await send({ action: "stopFillAll" });
      run = (response && response.run) || run;
    } finally {
      stopButton.disabled = false;
      render();
    }
  }

  // Per-page Autofill and document attaching touch the same page, so they wait while a run owns it.
  document.addEventListener("click", (event) => {
    const control = event.target.closest && event.target.closest("#btnAutofill, #btnDocuments, #documentsCard button");
    if (!control || !running()) return;
    event.stopPropagation();
    event.preventDefault();
    notice = "Fill all is running in this tab. Stop it before using Autofill or attaching documents.";
    render();
  }, true);

  startButton.addEventListener("click", start);
  stopButton.addEventListener("click", stop);
  // Another popup (the toolbar one) can start or stop the run, so a change to the record is read at once.
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "session" && changes.fillAllRun) refresh(); });
  // Copy and Clear change the worker's run record too, so the whole status is read again.
  new MutationObserver(refresh).observe(studentCard, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("focus", resolveTab);
  resolveTab();
  refresh();
})();
