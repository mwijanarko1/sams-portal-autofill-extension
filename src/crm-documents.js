if (!globalThis.__SAMS_CRM_DOCUMENTS_LOADED__) {
  globalThis.__SAMS_CRM_DOCUMENTS_LOADED__ = true;

  // The CRM Documents tab loads each section from its own endpoint. Approved: read-only GETs only.
  const DOCUMENT_GROUPS = [
    { group: "cv", endpoint: "fp_cv_docs", dataKey: "cv_docs", label: "Curriculum Vitae (CV)" },
    { group: "edu", endpoint: "fp_edu_docs", dataKey: "edu_docs", label: "Education History" },
    { group: "work_history", endpoint: "fp_work_history_docs", dataKey: "work_history_docs", label: "Work Experience" },
    { group: "eng_test", endpoint: "fp_get_eng_test_docs", dataKey: "eng_test_docs", label: "Test Score" },
    { group: "reference", endpoint: "fp_get_reference_docs", dataKey: "reference_docs", label: "References" },
    { group: "visa_history", endpoint: "fp_get_visa_history_docs", dataKey: "visa_history_docs", label: "Visa History" },
    { group: "visa_refusal", endpoint: "fp_get_visa_refusal_docs", dataKey: "visa_refusal_docs", label: "Visa Refusal" },
    { group: "passport", endpoint: "fp_get_passport_docs", dataKey: "passport_docs", label: "Passport" },
    { group: "additional", endpoint: "fp_get_additional_docs", dataKey: "additional_docs", label: "Additional Documentations" },
  ];
  const EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
  const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

  function leadId() {
    const match = location.pathname.match(/^\/agent\/leads\/full-profile\/(\d{1,12})\/?$/);
    return match ? match[1] : "";
  }

  function fileName(value) {
    return String(value || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 120);
  }

  // Keeps only the metadata the popup needs. Comments, staff details, download tokens, and
  // nested records are never copied.
  function toDocument(row, group, lead) {
    if (!row || String(row.lead_id) !== lead || !/^\d{1,12}$/.test(String(row.id))) return null;
    if (!SAMS_ALLOWLIST.isCrmFileUrl(row.file_url, location.origin)) return null;
    const extension = String(row.file_extension || row.file_url.split(".").pop()).toLowerCase();
    if (!EXTENSIONS.includes(extension)) return null;
    return {
      key: `${group.group}:${row.id}`,
      group: group.group,
      groupLabel: group.label,
      documentType: typeof row.document_type === "string" ? row.document_type.slice(0, 100) : null,
      name: fileName(row.name) || group.label,
      extension,
      url: row.file_url,
    };
  }

  async function listGroup(group, lead, token) {
    const response = await fetch(`/api/v2/agent/ajax/${group.endpoint}?lead_id=${lead}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
      credentials: "same-origin",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Document listing failed (${response.status}).`);
    const rows = (await response.json())?.data?.[group.dataKey];
    return Array.isArray(rows) ? rows.map((row) => toDocument(row, group, lead)).filter(Boolean) : [];
  }

  async function listDocuments() {
    const lead = leadId();
    const token = document.querySelector('meta[name="api-token"]')?.content;
    if (!lead || !token) return [];
    const groups = await Promise.all(DOCUMENT_GROUPS.map((group) => listGroup(group, lead, token)));
    return groups.flat();
  }

  function toBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  // Runs in the CRM page so the staff session cookie is first-party; extension-origin requests do
  // not carry it. Redirects are refused so a sign-in page can never stand in for the document.
  async function readDocument(url) {
    if (!SAMS_ALLOWLIST.isCrmFileUrl(url, location.origin)) {
      throw new Error("This document link is not an approved CRM file. Attach it manually.");
    }
    let response;
    try {
      response = await fetch(url, { credentials: "same-origin", redirect: "error", cache: "no-store" });
    } catch {
      throw new Error("Could not fetch this document from the CRM. Sign in to the CRM, Copy again, and retry.");
    }
    if (!response.ok) throw new Error(`The CRM refused this document (${response.status}). Copy from CRM again and retry.`);
    if (/^text\/html\b/i.test(response.headers.get("content-type") || "")) {
      throw new Error("The CRM returned a sign-in page instead of the document. Sign in to the CRM and Copy again.");
    }
    const tooLarge = "This document is larger than 10 MB. Attach it manually.";
    if (Number(response.headers.get("content-length")) > MAX_DOCUMENT_BYTES) throw new Error(tooLarge);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error(tooLarge);
    if (!bytes.length) throw new Error("The CRM returned an empty document. Attach it manually.");
    return toBase64(bytes);
  }

  const ACTIONS = {
    copyCrmDocuments: async () => ({ documents: await listDocuments() }),
    readCrmDocument: async (message) => ({ base64: await readDocument(message.url) }),
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const action = message && ACTIONS[message.action];
    if (!action) return;
    action(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  });
}
