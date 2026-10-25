/* SAMS portal scan, match, format, and fill engine. */
if (!globalThis.SAMS_SYNONYMS) throw new Error("SAMS synonym config was not loaded.");
var STOPWORDS = globalThis.SAMS_SYNONYMS.STOPWORDS;
var SYNONYM_MAP = globalThis.SAMS_SYNONYMS.SYNONYM_MAP;
var AUTOCOMPLETE_KEY_MAP = globalThis.SAMS_SYNONYMS.AUTOCOMPLETE_KEY_MAP;
var AUTOCOMPLETE_PURPOSES = globalThis.SAMS_SYNONYMS.AUTOCOMPLETE_PURPOSES;
var GENERIC_FIELDS = globalThis.SAMS_SYNONYMS.GENERIC_FIELDS;
var GENERIC_BLOCKED = globalThis.SAMS_SYNONYMS.GENERIC_BLOCKED;
var GENERIC_SELECT_EQUIV = globalThis.SAMS_SYNONYMS.GENERIC_SELECT_EQUIV || {};

if (globalThis.__SAMS_PORTAL_AUTOFILL_LOADED__) {
  // The engine is already registered in this frame.
} else {
globalThis.__SAMS_PORTAL_AUTOFILL_LOADED__ = true;

var FORBIDDEN_CONTROL_TEXT = /\b(submit|pay|send|delete|confirm|declare|agree|next|save|continue)\b/i;
var ACTIVE_PORTAL = (globalThis.SAMS_PORTALS || []).find(function (portal) {
  return (portal.origins || []).includes(location.origin) &&
    (!(portal.pageMatchers || []).length || portal.pageMatchers.some(function (matcher) {
      return typeof matcher === "string" ? location.pathname.includes(matcher) : matcher.test(location.pathname);
    }));
}) || null;

if (ACTIVE_PORTAL && ACTIVE_PORTAL.extraSynonyms) {
  Object.keys(ACTIVE_PORTAL.extraSynonyms).forEach(function (key) {
    SYNONYM_MAP[key] = (SYNONYM_MAP[key] || []).concat(ACTIVE_PORTAL.extraSynonyms[key]);
  });
}

function portalOverrideKey(element) {
  if (!ACTIVE_PORTAL) return "";
  var overrides = ACTIVE_PORTAL.selectorOverrides || {};
  var keys = Object.keys(overrides);
  for (var i = 0; i < keys.length; i++) {
    var selectors = Array.isArray(overrides[keys[i]]) ? overrides[keys[i]] : [overrides[keys[i]]];
    for (var j = 0; j < selectors.length; j++) {
      try { if (element.matches(selectors[j])) return keys[i]; } catch (error) { /* invalid selector */ }
    }
  }
  return "";
}

function portalBlocks(element) {
  if (!ACTIVE_PORTAL) return false;
  return (ACTIVE_PORTAL.blockedControls || []).some(function (selector) {
    try { return element.matches(selector) || !!element.closest(selector); } catch (error) { return false; }
  });
}

function safeClick(target, kind) {
  if (!target || FORBIDDEN_CONTROL_TEXT.test([
    target.textContent,
    target.getAttribute && target.getAttribute("aria-label"),
    target.getAttribute && target.getAttribute("title"),
  ].filter(Boolean).join(" "))) return false;
  if (target.closest && target.closest("button, a, [role='button']")) return false;
  if (portalBlocks(target)) return false;
  if (kind === "radio" && !(target.matches && target.matches('input[type="radio"]'))) return false;
  if (kind === "option" && !(target.matches && target.matches("[role='option'], lightning-base-combobox-item, .slds-listbox__option"))) return false;
  target.click();
  return true;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercase, collapse whitespace/dashes/underscores.
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/**
 * Truncate a string for display.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str;
}

/**
 * Escape HTML special characters for safe display.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Extract a meaningful terminal (last) token from a dotted/bracketed path.
 * E.g. "student[firstName]" → "firstName", "user.name" → "name", "input_123" → "input_123".
 * @param {string} str
 * @returns {string}
 */
function getTerminalToken(str) {
  if (!str) return "";
  // Split on common separators and path delimiters
  const parts = String(str).split(/[.\[\]_\-/\\:]+/).filter(Boolean);
  // Return the last part that isn't purely numeric
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(parts[i]) && parts[i].length >= 2) {
      return parts[i].toLowerCase().trim();
    }
  }
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase().trim() : "";
}

/** @type {Record<string, string[]>} */
var SYNONYM_CACHE = Object.create(null);
/** @type {Record<string, {synonyms:string[], synWords:Set<string>}>} */
var SYNONYM_META_CACHE = Object.create(null);

/**
 * Get all synonym strings (including the key itself) for a CRM field key,
 * normalized for comparison. Cached after first call.
 * @param {string} key
 * @returns {string[]}
 */
function getSynonyms(key) {
  if (SYNONYM_CACHE[key]) return SYNONYM_CACHE[key];
  var extras = SYNONYM_MAP[key] || [];
  var result = [key].concat(extras).map(normalize);
  SYNONYM_CACHE[key] = result;
  return result;
}

/**
 * Precomputed synonym list + word set for scoring. Cached per CRM key.
 * @param {string} key
 * @returns {{synonyms:string[], synWords:Set<string>}}
 */
function getSynonymMeta(key) {
  if (SYNONYM_META_CACHE[key]) return SYNONYM_META_CACHE[key];
  var synonyms = getSynonyms(key);
  var synWords = new Set();
  for (var t = 0; t < synonyms.length; t++) {
    var parts = synonyms[t].split(/\s+/);
    for (var p = 0; p < parts.length; p++) {
      if (parts[p].length > 2 && !STOPWORDS.has(parts[p])) synWords.add(parts[p]);
    }
  }
  var meta = { synonyms: synonyms, synWords: synWords };
  SYNONYM_META_CACHE[key] = meta;
  return meta;
}

/** Warm synonym caches for all known CRM keys (once). */
function warmSynonymCaches() {
  var keys = Object.keys(SYNONYM_MAP);
  for (var i = 0; i < keys.length; i++) getSynonymMeta(keys[i]);
}

/**
 * Build a stable CSS selector path for an element. Stops at the first
 * element with an id (since ids are unique within a page).
 * @param {Element} el
 * @returns {string}
 */
function getSelectorPath(el) {
  const parts = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = "#" + CSS.escape(current.id);
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += "." + classes.map(function (c) { return CSS.escape(c); }).join(".");
      }
    }
    // Add nth-of-type for positional uniqueness among same-tag siblings
    var parent = current.parentElement;
    if (parent) {
      var sameTag = Array.from(parent.children).filter(function (s) {
        return s.tagName === current.tagName;
      });
      if (sameTag.length > 1) {
        var index = sameTag.indexOf(current) + 1;
        selector += ":nth-of-type(" + index + ")";
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

/**
 * Check if an element is visible and enabled.
 * @param {Element} el
 * @returns {boolean}
 */
function isFillable(el) {
  if (el.disabled || el.readOnly || el.isConnected === false) return false;
  if (el.getAttribute && (el.getAttribute("aria-disabled") === "true" || el.getAttribute("aria-readonly") === "true")) return false;
  try {
    if (el.closest && el.closest("[inert]")) return false;
    if (el.matches && el.matches(":disabled")) return false;
  } catch (error) { /* non-DOM element */ }
  if (portalBlocks(el)) return false;

  var rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  var style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  return true;
}

// ─── Label detection ────────────────────────────────────────────────────

/**
 * Get the best human-readable label for a form element.
 * Uses multiple strategies in priority order, never mutating the DOM.
 * Strict mode returns only text the page associates with this control.
 *
 * @param {Element} el
 * @param {boolean} [strict]
 * @returns {string}
 */
function getLabelForElement(el, strict) {
  // 1. aria-label
  var ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // 2. aria-labelledby (support multiple ids)
  var labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    var ids = labelledby.split(/\s+/);
    var texts = [];
    for (var i = 0; i < ids.length; i++) {
      var ref = document.getElementById(ids[i]);
      if (ref) {
        var t = ref.textContent.trim();
        if (t) texts.push(t);
      }
    }
    if (texts.length > 0) return texts.join(" ");
  }

  // 3. label[for="elId"]
  if (el.id) {
    var labelEl = document.querySelector("label[for=\"" + CSS.escape(el.id) + "\"]");
    if (labelEl) {
      var text = labelEl.textContent.trim();
      if (text) return text;
    }
  }

  // 4. Wrapping <label> ancestor (without mutating DOM)
  var parent = el.parentElement;
  while (parent) {
    if (parent.tagName === "LABEL") {
      // Collect label text while excluding the input's own contribution
      var labelText = extractLabelTextExcludingChild(parent, el);
      if (labelText) return labelText;
    }
    parent = parent.parentElement;
  }

  // 5. Nearest preceding label element (sibling or nearby)
  var prevLabel = strict ? "" : findNearestPrecedingLabel(el);
  if (prevLabel) return prevLabel;

  // 6. placeholder
  var placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return placeholder.trim();

  // 7. title attribute
  var title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();

  // 8. name or id as fallback
  return strict ? "" : el.name || el.id || "";
}

/**
 * Extract text from a label element, excluding the text contributed by a child element.
 * Does NOT mutate the DOM (does not clone or remove children).
 * @param {Element} labelEl - the <label> element
 * @param {Element} childEl - the child to exclude (usually the input/select/textarea)
 * @returns {string}
 */
function extractLabelTextExcludingChild(labelEl, childEl) {
  var parts = [];
  for (var i = 0; i < labelEl.childNodes.length; i++) {
    var node = labelEl.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      var t = node.textContent.trim();
      if (t) parts.push(t);
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.contains(childEl) && node !== childEl) {
      var t = node.textContent.trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(" ").trim();
}

/**
 * Find the nearest preceding <label> element in the DOM that could be
 * associated with the given element.
 * Checks:
 *   - Previous element sibling
 *   - Previous sibling's contained <label>
 *   - Closest ancestor's previous sibling <label>
 * @param {Element} el
 * @returns {string|null}
 */
function findNearestPrecedingLabel(el) {
  // Check previous sibling
  var prev = el.previousElementSibling;
  if (prev) {
    if (prev.tagName === "LABEL") {
      var t = prev.textContent.trim();
      if (t) return t;
    }
    // Check if previous sibling contains a label
    var innerLabel = prev.querySelector("label");
    if (innerLabel) {
      var t = innerLabel.textContent.trim();
      if (t) return t;
    }
  }

  // Walk up and look for a parent's previous sibling with a label
  var walk = el.parentElement;
  while (walk && walk !== document.body) {
    var psib = walk.previousElementSibling;
    if (psib) {
      if (psib.tagName === "LABEL") {
        var t = psib.textContent.trim();
        if (t) return t;
      }
      // Maybe the previous sibling has a label inside
      var inner = psib.querySelector("label");
      if (inner) {
        var t = inner.textContent.trim();
        if (t) return t;
      }
      // Maybe the previous sibling itself is a heading that acts as label
      if (/^H[1-6]$/.test(psib.tagName)) {
        var t = psib.textContent.trim();
        if (t) return t;
      }
    }
    walk = walk.parentElement;
  }

  return null;
}

/**
 * Get the text content of aria-describedby references.
 * @param {Element} el
 * @returns {string}
 */
function getAriaDescribedbyText(el) {
  var describedby = el.getAttribute("aria-describedby");
  if (!describedby) return "";
  var ids = describedby.split(/\s+/);
  var texts = [];
  for (var i = 0; i < ids.length; i++) {
    var ref = document.getElementById(ids[i]);
    if (ref) {
      var t = ref.textContent.trim();
      if (t) texts.push(t);
    }
  }
  return texts.join(" ");
}

/**
 * Find the text of the closest fieldset legend ancestor.
 * @param {Element} el
 * @returns {string}
 */
function getClosestFieldsetLegend(el) {
  var parent = el.parentElement;
  while (parent) {
    if (parent.tagName === "FIELDSET") {
      var legend = parent.querySelector("legend");
      if (legend) {
        var t = legend.textContent.trim();
        return t || "";
      }
      return "";
    }
    parent = parent.parentElement;
  }
  return "";
}

/**
 * Find the text of the nearest preceding heading (h1-h6).
 * @param {Element} el
 * @returns {string}
 */
function getNearestHeading(el) {
  // Walk up the tree (including Lightning shadow hosts), checking previous siblings.
  var current = el;
  var steps = 0;
  while (current && steps < 30) {
    steps++;
    var prev = current.previousElementSibling;
    if (prev) {
      var headings = prev.querySelectorAll ? prev.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, .slds-section__title, .slds-form-element__legend") : [];
      if (headings && headings.length > 0) {
        return headings[headings.length - 1].textContent.trim();
      }
      if (prev.tagName && (/^H[1-6]$/.test(prev.tagName) || prev.tagName === "LEGEND")) {
        return prev.textContent.trim();
      }
      // Salesforce section titles often use spans/divs with strong text
      var t = (prev.textContent || "").trim();
      if (
        t &&
        t.length < 80 &&
        /academic history|employment history|english language|your details|education|qualification|nominated contact|new nominated|emergency contact/i.test(t)
      ) {
        return t;
      }
    }
    var parent = current.parentElement;
    if (parent) {
      var parentPrev = parent.previousElementSibling;
      if (parentPrev) {
        var headings2 = parentPrev.querySelectorAll
          ? parentPrev.querySelectorAll("h1, h2, h3, h4, h5, h6, legend")
          : [];
        if (headings2 && headings2.length > 0) {
          return headings2[headings2.length - 1].textContent.trim();
        }
        if (parentPrev.tagName && /^H[1-6]$/.test(parentPrev.tagName)) {
          return parentPrev.textContent.trim();
        }
        var t2 = (parentPrev.textContent || "").trim();
        if (
          t2 &&
          t2.length < 80 &&
          /academic history|employment history|english language|nominated contact|new nominated|emergency contact/i.test(t2)
        ) {
          return t2;
        }
      }
    }
    // Climb out of open shadow roots
    try {
      var root = current.getRootNode && current.getRootNode();
      if (root && root.host) {
        current = root.host;
        continue;
      }
    } catch (e) { /* ignore */ }
    current = parent;
  }
  return "";
}

/**
 * Get nearby text snippets from siblings and container for context.
 * Collects short text nodes from the parent and grandparent.
 * @param {Element} el
 * @returns {string}
 */
function getNearbyText(el) {
  var snippets = [];
  var parent = el.parentElement;
  if (!parent) return "";

  // From the parent, collect text from non-label element siblings
  var children = parent.children;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child === el || child.tagName === "LABEL" || child.contains(el)) continue;
    var t = child.textContent.trim();
    if (t && t.length > 3 && t.length < 200) {
      snippets.push(t);
    }
  }

  // From the grandparent, look for descriptive text
  var grandparent = parent.parentElement;
  if (grandparent && snippets.length < 3) {
    var gpChildren = grandparent.children;
    for (var j = 0; j < gpChildren.length; j++) {
      var gpChild = gpChildren[j];
      if (gpChild === parent || gpChild.contains(parent)) continue;
      var t = gpChild.textContent.trim();
      if (t && t.length > 3 && t.length < 200) {
        snippets.push(t);
      }
    }
  }

  return snippets.join(" | ").slice(0, 300);
}

// ─── Form field scanning ────────────────────────────────────────────────

/**
 * CSS selectors for fillable form fields.
 * Includes radio for Ulster QA Yes/No + Fee Payment Method groups.
 * Excludes hidden, password, submit, button, reset, file, image,
 * checkbox, color, and range inputs.
 */
const FIELD_SELECTORS = [
  "input:not([type=hidden]):not([type=password]):not([type=submit])" +
  ":not([type=button]):not([type=reset]):not([type=file])" +
  ":not([type=image]):not([type=checkbox])" +
  ":not([type=color]):not([type=range])",
  "select",
  "textarea",
].join(", ");

/**
 * Open or closed shadow root (Chrome extension API).
 * Ulster QA / Salesforce Flow uses closed LWC shadow for picklists.
 * @param {Element} el
 * @returns {ShadowRoot|null}
 */
function getAccessibleShadowRoot(el) {
  if (!el) return null;
  try {
    if (el.shadowRoot) return el.shadowRoot;
  } catch (e0) { /* ignore */ }
  try {
    if (typeof chrome !== "undefined" && chrome.dom && typeof chrome.dom.openOrClosedShadowRoot === "function") {
      return chrome.dom.openOrClosedShadowRoot(el) || null;
    }
  } catch (e1) { /* ignore */ }
  return null;
}

/**
 * Query selector across open + closed shadow roots (Salesforce Lightning / LWC).
 * Closed roots require chrome.dom.openOrClosedShadowRoot (extension-only).
 * @param {string} selector
 * @param {Document|ShadowRoot|Element} [root]
 * @returns {Element[]}
 */
function querySelectorAllDeep(selector, root) {
  var out = [];
  var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function walk(node, depth) {
    if (!node || depth > 24) return;
    try {
      if (node.querySelectorAll) {
        var matches = node.querySelectorAll(selector);
        for (var i = 0; i < matches.length; i++) {
          var el = matches[i];
          if (seen) {
            if (seen.has(el)) continue;
            seen.add(el);
          }
          out.push(el);
        }
      }
      var all = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (var j = 0; j < all.length; j++) {
        var child = all[j];
        var sr = getAccessibleShadowRoot(child);
        if (sr) walk(sr, depth + 1);
      }
    } catch (e) {
    // Cross-origin or inaccessible, skip
    }
  }

  walk(root || document, 0);
  return out;
}

/**
 * Label heuristics for Lightning Web Components (Salesforce Experience Cloud).
 * Walks out of shadow roots via .host when needed.
 * @param {Element} el
 * @returns {string}
 */
function getLightningLabel(el) {
  // 1. Standard strategies already cover aria/label[for]/placeholder
  // 2. Climb composed path: lightning-input / lightning-combobox often holds the label
  var node = el;
  for (var depth = 0; depth < 8 && node; depth++) {
    var host = null;
    try {
      var root = node.getRootNode && node.getRootNode();
      if (root && root.host) host = root.host;
    } catch (e) { /* ignore */ }

    var candidates = [node, host].filter(Boolean);
    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      var tag = (cand.tagName || "").toLowerCase();
      if (tag.indexOf("lightning-") === 0 || tag.indexOf("c-") === 0 || tag.indexOf("runtime_") === 0) {
        var lab =
          cand.getAttribute("label") ||
          cand.getAttribute("data-label") ||
          cand.getAttribute("field-label") ||
          cand.getAttribute("aria-label") ||
          "";
        if (lab && lab.trim() && lab.trim().toLowerCase() !== "select an option") {
          return lab.trim();
        }
        // label in host shadow
        try {
          if (cand.shadowRoot) {
            var labEl = cand.shadowRoot.querySelector(
              "label, .slds-form-element__label, legend, .slds-form-element__legend"
            );
            if (labEl) {
              var t = (labEl.textContent || "").replace(/\*/g, "").trim();
              if (t && t.toLowerCase() !== "select an option") return t;
            }
          }
        } catch (e2) { /* ignore */ }
      }
      // name attribute on host often matches Salesforce API name
      if (cand.getAttribute && cand.getAttribute("name") && !el.name) {
        // prefer human label; fall through
      }
    }

    if (host) node = host;
    else node = node.parentElement;
  }
  return "";
}

/**
 * Scan the document for fillable form fields.
 * Returns an array of rich field descriptors with full metadata.
 * Pierces open shadow DOM (required for Salesforce Lightning portals).
 *
 * @returns {Array<{element:Element, name:string, id:string, label:string, type:string, tagName:string, selector:string, autocomplete:string, title:string, required:boolean, placeholder:string, currentValue:string, hasValue:boolean, fieldsetLegend:string, nearestHeading:string, nearbyText:string, ariaDescribedby:string, options:Array<{value:string,text:string}>|null, visible:boolean, enabled:boolean}>}
 */
function scanFormFields(opts) {
  var lean = !!(opts && (opts.lean || opts.mode === "lean"));
  var fillMode = true;
  if (opts && opts.mode === "full") fillMode = false;
  if (lean) fillMode = false;

  var results = [];
  var elements = querySelectorAllDeep(FIELD_SELECTORS);

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (!isFillable(el)) continue;

    var tagName = el.tagName.toLowerCase();
    var type = el.getAttribute("type") || tagName;
    var name = el.name || "";
    // Salesforce host name often more useful than generated id
    if (!name) {
      try {
        var root = el.getRootNode && el.getRootNode();
        if (root && root.host && root.host.getAttribute) {
          name = root.host.getAttribute("name") || root.host.getAttribute("data-field") || "";
        }
      } catch (e) { /* ignore */ }
    }
    var id = el.id || "";
    var currentVal = el.value || "";
    var autocomplete = el.getAttribute("autocomplete") || "";
    var required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
    // Radios always have a value attribute; "filled" means checked in the group
    var hasValue = false;
    if (type === "radio") {
      hasValue = !!el.checked;
      if (!hasValue && name) {
        try {
          var grp = document.getElementsByName(name);
          for (var gi = 0; gi < grp.length; gi++) {
            if (grp[gi].type === "radio" && grp[gi].checked) {
              hasValue = true;
              break;
            }
          }
        } catch (eG) { /* ignore */ }
      }
    } else {
      hasValue = !!(currentVal && String(currentVal).trim());
    }

    var label = getLabelForElement(el);
    if (!label || label === id || label === name) {
      var lit = getLightningLabel(el);
      if (lit) label = lit;
    }
    // Prefer aria-label on Ulster radios ("Self Funding") when generic
    if (type === "radio") {
      var aria = el.getAttribute("aria-label");
      if (aria && aria.trim()) label = aria.trim();
      // Ulster Relationship radios: Parent / Guardian / … on parent node
      if (!aria || !aria.trim()) {
        try {
          var rParent = el.parentElement;
          if (rParent && rParent.innerText) {
            var rLab = rParent.innerText.replace(/\s+/g, " ").trim();
            if (rLab && rLab.length < 40) label = rLab;
          }
        } catch (eR) { /* ignore */ }
      }
    }

    var nominatedContext = isInsideNominatedModal(el);
    var overrideCrmKey = portalOverrideKey(el);

    // Lean auto-scan: identity only (no expensive context walks / selector paths)
    if (lean) {
      results.push({
        element: el,
        name: name,
        id: id,
        label: label,
        type: type,
        tagName: tagName,
        autocomplete: autocomplete,
        currentValue: currentVal,
        hasValue: hasValue,
        nominatedContext: nominatedContext,
        overrideCrmKey: overrideCrmKey,
        visible: true,
        enabled: true,
      });
      continue;
    }

    // Select options only in full mode (autofill reads live el.options)
    var options = null;
    if (!fillMode && tagName === "select") {
      options = [];
      for (var j = 0; j < el.options.length; j++) {
        var o = el.options[j];
        options.push({ value: o.value, text: o.text });
      }
    }

    var descriptor = {
      element: el,
      name: name,
      id: id,
      label: label,
      type: type,
      tagName: tagName,
      selector: fillMode ? "" : getSelectorPath(el),
      autocomplete: autocomplete,
      title: el.getAttribute("title") || "",
      placeholder: el.getAttribute("placeholder") || "",
      required: required,
      currentValue: currentVal,
      hasValue: hasValue,
      fieldsetLegend: getClosestFieldsetLegend(el),
      nearestHeading: getNearestHeading(el),
      nominatedContext: nominatedContext,
      overrideCrmKey: overrideCrmKey,
      nearbyText: fillMode ? "" : getNearbyText(el),
      ariaDescribedby: fillMode ? "" : getAriaDescribedbyText(el),
      options: options,
      visible: true,
      enabled: true,
    };

    results.push(descriptor);
  }

  return results;
}

/**
 * Precompute match metadata once per scanned field.
 * Avoids repeated sectionFromDom walks inside the K×D scoring loop.
 * @param {Array} fields
 */
function precomputeFieldMatchMeta(fields) {
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    f._identifier = getFieldIdentifier(f);
    f._terminalToken = getTerminalToken(f.name);
    f._sectionKind = getSectionKind(f);
  }
}

/**
 * Get all unique identifier strings for a field descriptor.
 * Uses field-specific tokens (name, id, label). Section context is applied
 * separately via sectionKindBoost (academic vs employment).
 * @param {{name:string, id:string, label:string}} field
 * @returns {string}
 */
function getFieldIdentifier(field) {
  // Include section legend/heading so Ulster radios (aria-label Yes/No) still
  // match via group name + "Have You Previously…" legend text.
  // nominatedContext is set during scan for Ulster NEW NOMINATED CONTACT modal.
  return [
    field.name,
    field.id,
    field.label,
    field.fieldsetLegend,
    field.nearestHeading,
    field.nominatedContext ? "nominated contact" : "",
  ].filter(Boolean).join(" ");
}

/**
 * True if element sits in Ulster QA "NEW NOMINATED CONTACT" / emergency Add New modal.
 * Bare labels (*Phone, *Email, *First Name) need this so they don't map to applicant fields.
 * @param {Element} el
 * @returns {boolean}
 */
function isInsideNominatedModal(el) {
  if (!el) return false;
  var node = el;
  for (var i = 0; i < 22 && node; i++) {
    // API name markers on self or Lightning host
    var nm = (node.name || (node.getAttribute && node.getAttribute("name")) || "").toString();
    if (/new_contact_|new_text_contact|new_relationship_to_you|new_u18_date|special_instructions/i.test(nm)) {
      return true;
    }
    try {
      var root = node.getRootNode && node.getRootNode();
      if (root && root.host) {
        var host = root.host;
        var hn = host.getAttribute("name") || host.getAttribute("label") || "";
        if (/new_contact_|new_text_contact|new_relationship|new_u18|special_instructions/i.test(hn)) {
          return true;
        }
  // Bounded text window, modal panel, not whole body
        var hostText = "";
        try {
          hostText = (host.innerText || "").slice(0, 2200);
        } catch (eT) { /* ignore */ }
        if (
          hostText.length > 40 &&
          hostText.length < 2200 &&
          /NEW NOMINATED CONTACT/i.test(hostText) &&
          /Relationship To You/i.test(hostText)
        ) {
          return true;
        }
        node = host;
        continue;
      }
    } catch (e1) { /* ignore */ }

    if (node !== document.body && node !== document.documentElement) {
      var slice = "";
      try {
        slice = (node.innerText || "").slice(0, 2200);
      } catch (e2) { /* ignore */ }
      if (
        slice.length > 40 &&
        slice.length < 2200 &&
        /NEW NOMINATED CONTACT/i.test(slice) &&
        /Relationship To You/i.test(slice)
      ) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

/** CRM keys that belong to academic / education history sections. */
const ACADEMIC_CRM_KEYS = new Set([
  "institutionName", "degree", "major", "studyDates", "startDate", "endDate",
  "graduationYear", "gpa", "previousEducation", "qualificationLevel",
  "qualificationType", "grade", "awardStatus", "studyCountry",
  "studyStartYear", "studyEndYear",
  "englishFirstLanguage", "otherEnglishLanguageExperience",
  "highestQualification", "hasUniversityDegree",
]);

/** CRM keys that belong to employment / work history sections. */
const EMPLOYMENT_CRM_KEYS = new Set([
  "cvCurrentJobTitle", "cvCurrentEmployer", "cvEmploymentStatus",
  "cvYearsExperience", "cvWorkStartDate", "cvWorkEndDate",
  "employerName", "jobTitle", "employmentCountry", "presentEmployment",
  "hasTwoYearsWorkExperience", "cvWorkLocation", "cvJobDescription",
  "occupation", "mainResponsibilities",
  "employerContactName", "employerContactEmail", "employerContactPhone",
]);

/**
 * Infer whether a field sits under Academic or Employment history.
 * Critical for Sunderland where both sections use "Organisation" and
 * "Month Year From/To".
 * @param {{label?:string,name?:string,id?:string,fieldsetLegend?:string,nearestHeading?:string,nearbyText?:string}} field
 * @returns {"academic"|"employment"|""}
 */
/**
 * Walk composed tree (including shadow hosts) looking for Academic/Employment section titles.
 * @param {Element} el
 * @returns {"academic"|"employment"|""}
 */
function sectionFromDom(el) {
  if (!el) return "";
  var node = el;
  for (var depth = 0; depth < 25 && node; depth++) {
    try {
      var probe = node;
      while (probe) {
        var prev = probe.previousElementSibling;
        while (prev) {
          var t = (prev.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
          if (/employment history/i.test(t)) return "employment";
          if (/academic history/i.test(t)) return "academic";
          if (/english language skills/i.test(t)) return "academic";
          prev = prev.previousElementSibling;
        }
        // Also scan parent text lightly (section wrappers)
        if (probe.className && /section|history|employment|academic/i.test(String(probe.className))) {
          var pt = (probe.textContent || "").slice(0, 120);
          if (/^[\s\S]{0,40}employment history/i.test(pt)) return "employment";
          if (/^[\s\S]{0,40}academic history/i.test(pt)) return "academic";
        }
        var root = probe.getRootNode && probe.getRootNode();
        if (root && root.host) probe = root.host;
        else probe = probe.parentElement;
      }
    } catch (e) { /* ignore */ }
    try {
      var r = node.getRootNode && node.getRootNode();
      if (r && r.host) node = r.host;
      else node = node.parentElement;
    } catch (e2) {
      node = node.parentElement;
    }
  }
  return "";
}

function getSectionKind(field) {
  var lab = normalize([field.label, field.name, field.id].filter(Boolean).join(" "));
  var type = normalize(field.type || "");
  // Strong label/name signals first
  if (/jobtitle|job title|present employment|present__c|employer|employment country/.test(lab)) {
    return "employment";
  }
  if (/qualification|program title|programme title|award status|\bgrade\b|studied|academic|education level/.test(lab)) {
    return "academic";
  }
  if (/otherenglish|english first language|english language/.test(lab)) {
    return "academic";
  }
  // Sunderland: Academic Organisation = search combobox; Employment Organisation = text Organisation__c
  if (/^organisation$|^organization$|organisation__c|organization__c/.test(lab)) {
    if (/organisation__c|organization__c/.test(lab)) return "employment";
    if (type === "search") return "academic";
    if (type === "text") return "employment";
  }

  // Live DOM section titles (Academic history / Employment history)
  if (field.element) {
    var fromDom = sectionFromDom(field.element);
    if (fromDom) return fromDom;
  }

  var ctx = normalize(
    [field.fieldsetLegend, field.nearestHeading, field.nearbyText].filter(Boolean).join(" ")
  );
  var hasEmp = /employment history|work history|professional experience|job history|employer/.test(ctx);
  var hasAca = /academic history|education history|higher education|qualification/.test(ctx);
      // "Academic and professional background" is the page stage, prefer more specific
  if (hasEmp && !/academic history/.test(ctx)) return "employment";
  if (hasAca && /academic history|education history|higher education/.test(ctx)) return "academic";
  if (hasEmp) return "employment";
  if (hasAca) return "academic";
  return "";
}

/**
 * Section-aware score adjustment so education keys don't win on employment
 * "Organisation" and vice versa.
 * @param {string} crmKey
 * @param {"academic"|"employment"|""} section
 * @param {number} score
 * @returns {number}
 */
function applySectionBoost(crmKey, section, score) {
  if (!section || score <= 0) return score;
  var isAca = ACADEMIC_CRM_KEYS.has(crmKey);
  var isEmp = EMPLOYMENT_CRM_KEYS.has(crmKey);
  if (section === "academic") {
    if (isEmp && !isAca) return Math.floor(score * 0.25);
    if (isAca) return score + 25;
  }
  if (section === "employment") {
    if (isAca && !isEmp) return Math.floor(score * 0.25);
    if (isEmp) return score + 25;
  }
  // Ambiguous "organisation"/"month year from" with no section: prefer label-specific keys only
  return score;
}

// ─── Matching and scoring ───────────────────────────────────────────────

/**
 * Score how well a field identifier matches a CRM key.
 * Returns an integer; higher = better match.
 *
 * Scoring components:
 *   1. Base synonym score (0-100): exact match, prefix/suffix, contains, etc.
 *   2. Word overlap score (0-30): proportion of meaningful field words in synonyms
 *   3. Autocomplete boost (0 or 65): autocomplete attribute maps to this CRM key
 *   4. Terminal token boost (0 or 50): last meaningful path segment matches a synonym
 *   5. Section boost/penalty (academic vs employment)
 *
 * Threshold for filling is 50 (checked in autofillPage).
 *
 * @param {string} crmKey
 * @param {string} fieldId - the combined identifier (name + " " + id + " " + label)
 * @param {string} [autocompleteValue] - the field's autocomplete attribute
 * @param {string} [terminalToken] - the field name's terminal path token
 * @param {"academic"|"employment"|""} [sectionKind]
 * @returns {number}
 */
function matchScore(crmKey, fieldId, autocompleteValue, terminalToken, sectionKind) {
  var nField = normalize(fieldId);

  // ── Reject empty or near-empty identifiers ───────────────────────
  if (!nField || nField.length < 3) {
    return 0;
  }

  // ── Salutation "title" vs employment "Job Title" ─────────────────
  // CRM key `title` is Mr/Mrs only. Never map it to Job Title / jobtitle__c.
  if (crmKey === "title") {
    if (/\bjob\b|\bposition\b|\brole\b|jobtitle|job_title|program title|programme title|course title|subject/.test(nField)) {
      return 0;
    }
  }

  // ── Other English Language Experience (Sunderland OtherEnglishLanguageExperience__c)
  // Exclusive: only the dedicated CRM key may claim this field.
  // Blocks nationality (autocomplete "language"), work experience, IELTS scores, etc.
  var isOtherEnglishField =
    /otherenglishlanguageexperience/.test(nField.replace(/\s+/g, "")) ||
    /\bother english language (experience|evidence)\b/.test(nField);
  if (isOtherEnglishField && crmKey !== "otherEnglishLanguageExperience") {
    return 0;
  }
  // Do not put Other-English free text into the Yes/No first-language combobox
  if (crmKey === "otherEnglishLanguageExperience") {
    if (/\bis english your first language\b|\benglish first language\b|\bfirst language\b/.test(nField) &&
        !isOtherEnglishField) {
      return 0;
    }
  }
  // Nationality must not match English-language fields (autocomplete "language" trap)
  if (crmKey === "nationality" && /\benglish\b|\blanguage experience\b|\blanguage skills\b/.test(nField)) {
    return 0;
  }

  // ── Funding: main combobox vs "Other funding source" free-text ─────
  // Live Sunderland: "How are you intending to fund this programme?" → Self-Funding
  // "Other funding source" (Otherfundingsource__c) only when type is Other.
  // Ulster QA: radio group label "Fee Payment Method" → Self Funding / Sponsorship
  var isOtherFundingField =
    /otherfundingsource/.test(nField.replace(/\s+/g, "")) ||
    /\bother funding source\b|\bother source of funding\b/.test(nField);
  var isMainFundingField =
    !isOtherFundingField &&
    (/\bhow are you intending to fund\b/.test(nField) ||
      /\bfee payment method\b/.test(nField) ||
      (/\bfund(ing)?\b/.test(nField) && /\b(programme|program|tuition|intend)\b/.test(nField)) ||
      nField === "funding" ||
      nField === "funding source");
  if (isOtherFundingField && crmKey !== "otherFundingSource") {
    return 0; // never dump Self-Funding into Other funding source text
  }
  if (isMainFundingField && crmKey !== "funding") {
    return 0; // preferredCourse must not claim funding via bare "programme"
  }
  if (crmKey === "funding" && isOtherFundingField) {
    return 0;
  }
  if (crmKey === "preferredCourse" && /\bfund\b/.test(nField)) {
    return 0;
  }

  // ── Ulster QA exclusive locks (apply.qahighereducation.com, 2026-07-31) ──
  // Nominated / Emergency Add New modal context (API names + section titles).
  // nField is already normalize()'d (underscores → spaces).
  var isNominatedContext =
    /\bnominated\b|\bnew nominated\b|\bemergency contact\b|\brelationship to you\b|\bnew contact first name\b|\bnew contact last name\b|\bnew text contact email\b|\bnew relationship to you\b|\bnew u18 date of birth\b|\bspecial instructions\b|\bphone country dialing code\b|\bphone country dialling code\b|\bcountry dialing code\b/.test(
      nField
    );
  // Main contact phone country code (not modal "dialing code")
  var isPhoneCountryCodeField =
    !isNominatedContext &&
    (/\b(phone|mobile|telephone)\s+country\s+code\b/.test(nField) ||
      nField === "phone country code" ||
      nField === "mobile country code");
  var isEmergencyDialingCodeField =
    /\bphone country dialing code\b|\bphone country dialling code\b|\bcountry dialing code\b|\bcountry dialling code\b|\bemergency phone country\b|\bnominated phone country\b/.test(
      nField
    ) ||
    (isNominatedContext &&
      /\b(phone|mobile|telephone)\b/.test(nField) &&
      /\b(country|dialing|dialling|code)\b/.test(nField));
  if (isPhoneCountryCodeField && crmKey !== "phoneCountryCode") {
    return 0; // phone number must not fill country-code lookup
  }
  if (crmKey === "phoneCountryCode" && !isPhoneCountryCodeField) {
    return 0;
  }
  if (isEmergencyDialingCodeField && crmKey !== "emergencyPhoneCountryCode") {
    return 0;
  }
  if (crmKey === "emergencyPhoneCountryCode" && !isEmergencyDialingCodeField) {
    return 0;
  }
  // National phone/mobile number (not country code, not emergency/nominated modal)
  var isUlsterPhoneNumberField =
    !isPhoneCountryCodeField &&
    !isEmergencyDialingCodeField &&
    !isNominatedContext &&
    !/\bemergency\b|\bnext of kin\b|\bnominated\b/.test(nField) &&
    (nField === "phone" ||
      nField === "mobile" ||
      /^(phone|mobile|telephone)$/.test(nField) ||
      (/\b(phone|mobile|telephone)\b/.test(nField) && !/\bcountry\b|\bcode\b|\bdialing\b|\bdialling\b/.test(nField)));
  var isEmergencyPhoneField =
    !isEmergencyDialingCodeField &&
    (/\bemergency (phone|telephone|mobile)\b|\bnominated (phone|telephone|mobile)\b|\bnext of kin (phone|telephone)\b/.test(
      nField
    ) ||
      (isNominatedContext &&
        (nField === "phone" ||
          /^(phone|mobile|telephone)$/.test(nField) ||
          (/\b(phone|mobile|telephone)\b/.test(nField) &&
            !/\bcountry\b|\bcode\b|\bdialing\b|\bdialling\b|\bemail\b/.test(nField)))));
  if (crmKey === "phone" && (isPhoneCountryCodeField || isEmergencyDialingCodeField || isEmergencyPhoneField || isNominatedContext)) {
    return 0;
  }
  if (crmKey === "emergencyPhone" && !isEmergencyPhoneField) {
    return 0;
  }
  if (isEmergencyPhoneField && crmKey !== "emergencyPhone") {
    return 0;
  }
  // Nominated First / Last name, must not steal applicant givenName/familyName
  var isEmergencyFirstNameField =
    /\bnew contact first name\b|\bemergency first name\b|\bnominated first name\b|\bcontact first name\b/.test(nField) ||
    (isNominatedContext && /\bfirst name\b/.test(nField));
  var isEmergencyLastNameField =
    /\bnew contact last name\b|\bemergency last name\b|\bnominated last name\b|\bcontact last name\b/.test(nField) ||
    (isNominatedContext && /\blast name\b|\bsurname\b/.test(nField));
  if (isEmergencyFirstNameField && crmKey !== "emergencyFirstName") return 0;
  if (crmKey === "emergencyFirstName" && !isEmergencyFirstNameField) return 0;
  if (isEmergencyLastNameField && crmKey !== "emergencyLastName") return 0;
  if (crmKey === "emergencyLastName" && !isEmergencyLastNameField) return 0;
  // Nominated email
  var isEmergencyEmailField =
    /\bnew text contact email\b|\bemergency email\b|\bnominated (contact )?email\b|\bnext of kin email\b/.test(nField) ||
    (isNominatedContext && /\bemail\b/.test(nField));
  if (isEmergencyEmailField && crmKey !== "emergencyEmail") return 0;
  if (crmKey === "emergencyEmail" && !isEmergencyEmailField) return 0;
  if (crmKey === "email" && (isEmergencyEmailField || isNominatedContext)) return 0;
  // Relationship radios
  var isEmergencyRelationshipField =
    /\brelationship to you\b|\bnew relationship to you\b|\bemergency relationship\b|\bnominated relationship\b|\brelationship to applicant\b/.test(
      nField
    ) ||
    (isNominatedContext && /\brelationship\b/.test(nField));
  if (isEmergencyRelationshipField && crmKey !== "emergencyRelationship") return 0;
  if (crmKey === "emergencyRelationship" && !isEmergencyRelationshipField) return 0;
  // Emergency DOB (not applicant DOB)
  var isEmergencyDobField =
    /\bnew u18 date of birth\b|\bemergency date of birth\b|\bnominated date of birth\b|\bcontact date of birth\b/.test(
      nField
    ) ||
    (isNominatedContext && /\b(date of birth|dob|birth date)\b/.test(nField));
  if (isEmergencyDobField && crmKey !== "emergencyDateOfBirth") return 0;
  if (crmKey === "emergencyDateOfBirth" && !isEmergencyDobField) return 0;
  if (crmKey === "dateOfBirth" && isEmergencyDobField) return 0;
  // Special instructions (optional free text on modal)
  var isSpecialInstructionsField = /\bspecial instructions\b|\bspecial_instructions\b/.test(nField);
  if (isSpecialInstructionsField && crmKey !== "emergencySpecialInstructions") return 0;
  if (crmKey === "emergencySpecialInstructions" && !isSpecialInstructionsField) return 0;
    // Sex Identifier (Ulster), exclusive to gender
  if (/\bsex identifier\b|\bsex_identifier\b/.test(nField) && crmKey !== "gender") {
    return 0;
  }
  // Ethnicity exclusive
  if (/\bethnicity\b|\bethnic (origin|background|group)\b/.test(nField) && crmKey !== "ethnicity") {
    return 0;
  }
  // Dependants exclusive
  if (/\bdependants?\b/.test(nField) && crmKey !== "dependants") {
    return 0;
  }
  // Current Domicile exclusive (not nationality, not country of residence alone)
  if (/\b(current\s+)?domicile\b/.test(nField) && crmKey !== "currentDomicile") {
    return 0;
  }
  // Previously applied (Ulster long radio label)
  if (/\bpreviously applied\b|\benrolled onto a course with ulster\b|\bqahe partner\b/.test(nField) &&
      crmKey !== "previouslyApplied") {
    return 0;
  }
  // Previously known by other name
  if (/\bknown by any other name\b|\bprevious(ly)? name\b|\bformer name\b/.test(nField) &&
      crmKey !== "previousName") {
    return 0;
  }
  // Personal statement free text
  if (/\bpersonal statement\b|\bstatement of purpose\b/.test(nField) &&
      crmKey !== "personalStatement" && crmKey !== "cvProfessionalSummary") {
    return 0;
  }
  // Ulster QA: passport field is often labelled "Document Number" (not "Passport Number")
  var isDocumentNumberField =
    /\bdocument number\b|\bdocument no\b|\bdocument #\b|\bpassport document number\b|\bidentity document number\b/.test(
      nField
    );
  if (isDocumentNumberField && crmKey !== "passportNumber") {
    return 0;
  }
  // Ulster NEW EMPLOYMENT HISTORY modal
  var isOccupationField =
    /\bemployment occupation\b|\boccupation\b/.test(nField) &&
    !/\bmain responsib|\bjob description\b/.test(nField);
  if (isOccupationField && crmKey !== "occupation" && crmKey !== "cvCurrentJobTitle" && crmKey !== "jobTitle") {
    return 0;
  }
  // Prefer dedicated occupation key over generic job title when label is Occupation
  if (isOccupationField && (crmKey === "cvCurrentJobTitle" || crmKey === "jobTitle")) {
      // allow as fallback only if occupation key not stronger, scored below with lower lock
  }
  var isMainResponsibilitiesField =
    /\bmain responsibilit|\bkey responsibilit|\bmain duties\b|\bjob responsibilit/.test(nField);
  if (isMainResponsibilitiesField && crmKey !== "mainResponsibilities") {
    return 0;
  }
  if (crmKey === "mainResponsibilities" && !isMainResponsibilitiesField) {
    return 0;
  }
  var isJobDescriptionField =
    /\bmy job description\b|\bjob description\b|\brole description\b/.test(nField) &&
    !isMainResponsibilitiesField;
  if (isJobDescriptionField && crmKey !== "cvJobDescription") {
    return 0;
  }
  if (crmKey === "cvJobDescription" && !isJobDescriptionField) {
    return 0;
  }
  // Company Name vs Employer's Name (person)
  var isCompanyNameField =
    /\bcompany name\b|\bnew company name\b|\bnew_company_name\b/.test(nField);
  var isEmployerContactNameField =
    /\bemployer'?s? name\b|\bnew employer\b|\bemployer contact name\b/.test(nField) &&
    !/\bcompany\b|\bemail\b|\bphone\b/.test(nField);
  if (isCompanyNameField && crmKey !== "cvCurrentEmployer" && crmKey !== "employerName") {
    return 0;
  }
  if (isEmployerContactNameField && crmKey !== "employerContactName") {
    return 0;
  }
  if (crmKey === "employerContactName" && !isEmployerContactNameField) {
    return 0;
  }
  // Don't dump applicant email/phone into employer contact fields
  if (/\bemployer'?s? email\b|\bemployer email\b/.test(nField) && crmKey !== "employerContactEmail") {
    return 0;
  }
  if (/\bemployer'?s? phone\b|\bemployer phone\b/.test(nField) && crmKey !== "employerContactPhone") {
    return 0;
  }
  if (crmKey === "email" && /\bemployer/.test(nField)) return 0;
  if (crmKey === "phone" && /\bemployer/.test(nField)) return 0;

  // Ulster NEW EDUCATION HISTORY: Start Year / End Year / Country
  var isStudyStartYearField =
    /\bstart year\b|\bstudy start year\b|\beducation start year\b|\bpickist start year\b|\bpicklist start year\b/.test(
      nField
    );
  var isStudyEndYearField =
    /\bend year\b|\bstudy end year\b|\beducation end year\b|\bpredicted end year\b|\bpicklist end year\b/.test(
      nField
    );
  if (isStudyStartYearField && crmKey !== "studyStartYear" && crmKey !== "startDate") {
    return 0;
  }
  if (isStudyEndYearField && crmKey !== "studyEndYear" && crmKey !== "endDate" && crmKey !== "graduationYear") {
    return 0;
  }
  if (crmKey === "studyStartYear" && !isStudyStartYearField) return 0;
  if (crmKey === "studyEndYear" && !isStudyEndYearField) return 0;
  // Don't put graduation year into Start Year
  if (crmKey === "graduationYear" && isStudyStartYearField) return 0;
  // Education Country (select), exclusive to studyCountry when in education modal
  var isEducationCountryField =
    (/\bpicklist country\b|\beducation country\b|\bcountry of study\b|\bcountry you studied\b|\bstudy country\b/.test(nField) ||
      (/\bcountry\b/.test(nField) &&
        /\beducation|qualification|institution|start year|end year|results\b/.test(nField))) &&
    !/\bemployment\b|\bemployer\b|\bphone country\b|\bmobile country\b|\bdialing\b|\bdialling\b|\bnationality\b|\bdomicile\b/.test(
      nField
    );
  // Bare "Country" on education form: name picklist_Country
  if (/\bpicklist_?country\b|\bpicklist country\b/.test(nField)) {
    isEducationCountryField = true;
  }
  if (isEducationCountryField && crmKey !== "studyCountry") {
    return 0;
  }
  // Education Institution combobox
  var isEducationInstitutionField =
    /\beducation institution\b|\bname of (school|university|institution)\b/.test(nField);
  if (isEducationInstitutionField && crmKey !== "institutionName") {
    return 0;
  }
  // Results radios (Completed / In Progress)
  var isEducationResultsField =
    /\bresults\b|\bpicklist results\b|\baward status\b|\bcompletion status\b/.test(nField) &&
    !/\btest\b|\bexam score\b/.test(nField);
  if (isEducationResultsField && /\bresults\b/.test(nField) && crmKey !== "awardStatus") {
    // bare "results" only for awardStatus
    if (crmKey !== "awardStatus") return 0;
  }

  var synMeta = getSynonymMeta(crmKey);
  var synonyms = synMeta.synonyms;
  var baseScore = 0;

    // Salutation: exact "Title" label (no bare "title" synonym, removed to protect Job Title)
  if (crmKey === "title" && (nField === "title" || /^title\b/.test(nField))) {
    baseScore = Math.max(baseScore, 100);
  }
  // Exact Sunderland Other English field → lock score
  if (crmKey === "otherEnglishLanguageExperience" && isOtherEnglishField) {
    baseScore = Math.max(baseScore, 100);
  }
  // Main funding combobox → lock score for funding key
  if (crmKey === "funding" && isMainFundingField) {
    baseScore = Math.max(baseScore, 100);
  }
  // Ulster QA locks
  if (crmKey === "phoneCountryCode" && isPhoneCountryCodeField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "phone" && isUlsterPhoneNumberField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyPhoneCountryCode" && isEmergencyDialingCodeField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyPhone" && isEmergencyPhoneField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyFirstName" && isEmergencyFirstNameField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyLastName" && isEmergencyLastNameField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyEmail" && isEmergencyEmailField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyRelationship" && isEmergencyRelationshipField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencyDateOfBirth" && isEmergencyDobField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "emergencySpecialInstructions" && isSpecialInstructionsField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "gender" && /\bsex identifier\b|\bsex_identifier\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "ethnicity" && /\bethnicity\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "dependants" && /\bdependants?\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "currentDomicile" && /\bdomicile\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "previouslyApplied" && /\bpreviously applied\b|\bqahe partner\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "previousName" && /\bknown by any other name\b|\bprevious(ly)? name\b/.test(nField)) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "passportNumber" && isDocumentNumberField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "occupation" && isOccupationField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "mainResponsibilities" && isMainResponsibilitiesField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "cvJobDescription" && isJobDescriptionField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "employerContactName" && isEmployerContactNameField) {
    baseScore = Math.max(baseScore, 100);
  }
  // Prefer occupation key over job title when both could match Employment Occupation
  if ((crmKey === "cvCurrentJobTitle" || crmKey === "jobTitle") && isOccupationField) {
    baseScore = Math.max(baseScore, 70);
  }
  if (crmKey === "studyStartYear" && isStudyStartYearField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "studyEndYear" && isStudyEndYearField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "startDate" && isStudyStartYearField) {
    baseScore = Math.max(baseScore, 80);
  }
  if ((crmKey === "endDate" || crmKey === "graduationYear") && isStudyEndYearField) {
    baseScore = Math.max(baseScore, 80);
  }
  if (crmKey === "studyCountry" && isEducationCountryField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "institutionName" && isEducationInstitutionField) {
    baseScore = Math.max(baseScore, 100);
  }
  if (crmKey === "awardStatus" && isEducationResultsField) {
    baseScore = Math.max(baseScore, 100);
  }

  // ── 1. Base synonym scoring ──────────────────────────────────────
  for (var s = 0; s < synonyms.length; s++) {
    var syn = synonyms[s];
    if (!syn || syn.length < 2) continue;

    // Exact match is strongest, but still subject to section boost/penalty
    // (e.g. "Organisation" maps to both university and employer).
    if (nField === syn) {
      baseScore = Math.max(baseScore, 100);
      continue;
    }

    // Word-boundary-aware check using \b regex
    var escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wordBoundaryRe = new RegExp('\\b' + escaped + '\\b', 'i');
    var hasWordBoundary = wordBoundaryRe.test(nField);

    // starts-with or ends-with as a whole word
    if (hasWordBoundary && (nField.startsWith(syn + " ") || nField.endsWith(" " + syn))) {
      baseScore = Math.max(baseScore, 85);
    }
  // Word-boundaried contains (but not start/end, already scored above)
    else if (hasWordBoundary) {
      baseScore = Math.max(baseScore, 65);
    }

  // Bare substring contains, lowered well below threshold; only helps combined signals.
    // Short synonyms (<=4 chars) skip bare substring entirely to avoid false positives.
    if (syn.length > 4 && nField.includes(syn)) {
      baseScore = Math.max(baseScore, 35);
    }

    // Synonym contains the field identifier as a whole word (checked with word boundary)
    if (nField.length >= 4) {
      var escapedField = nField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var fieldBoundaryRe = new RegExp('\\b' + escapedField + '\\b', 'i');
      if (fieldBoundaryRe.test(syn)) {
        baseScore = Math.max(baseScore, 40);
      }
    }
  }

  // ── 2. Word-overlap scoring (uses cached syn word set) ───────────
  var fieldWords = nField.split(/\s+/).filter(function (w) {
    return w.length > 2 && !STOPWORDS.has(w);
  });
  var synWords = synMeta.synWords;

  if (fieldWords.length > 0 && synWords.size > 0) {
    var matchCount = 0;
    for (var f = 0; f < fieldWords.length; f++) {
      if (synWords.has(fieldWords[f])) matchCount++;
    }
    if (matchCount > 0) {
      var proportion = matchCount / fieldWords.length;
      if (proportion >= 0.3) {
        baseScore = Math.max(baseScore, Math.min(30, Math.round(proportion * 30)));
      }
    }
  }

  // ── 3. Autocomplete boost ────────────────────────────────────────
  var autoScore = 0;
  if (autocompleteValue) {
    var normAuto = normalize(autocompleteValue);
    var mappedKey = AUTOCOMPLETE_KEY_MAP[normAuto];
    if (mappedKey === crmKey) {
      autoScore = 65;
    }
    // Also check: autocomplete value itself might be in the synonym set
    if (autoScore === 0) {
      for (var a = 0; a < synonyms.length; a++) {
        if (synonyms[a].includes(normAuto) || normAuto === synonyms[a]) {
          autoScore = Math.max(autoScore, 40);
          break;
        }
      }
    }
  }

  // ── 4. Terminal token boost ──────────────────────────────────────
  var terminalScore = 0;
  if (terminalToken) {
    var normToken = normalize(terminalToken);
    if (normToken.length >= 3) {
      for (var tk = 0; tk < synonyms.length; tk++) {
        var syn = synonyms[tk];
        if (normToken === syn) {
          terminalScore = 50;
          break;
        }
        if (syn.includes(normToken) || normToken.includes(syn)) {
          terminalScore = Math.max(terminalScore, 30);
        }
      }
    }
  }

  var total = baseScore + autoScore + terminalScore;
  return applySectionBoost(crmKey, sectionKind || "", total);
}

// ─── Filling ────────────────────────────────────────────────────────────

/**
 * Parse a date-ish string into { y, m, d } or null.
 * Accepts ISO (YYYY-MM-DD), UK (DD/MM/YYYY or DD-MM-YYYY), and US (MM/DD/YYYY) when unambiguous.
 * @param {string} raw
 * @returns {{y:string,m:string,d:string}|null}
 */
function parseDateParts(raw) {
  if (!raw || typeof raw !== "string") return null;
  var s = raw.trim();
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return {
      y: iso[1],
      m: iso[2].padStart(2, "0"),
      d: iso[3].padStart(2, "0"),
    };
  }
  var slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    var a = parseInt(slash[1], 10);
    var b = parseInt(slash[2], 10);
    var y = slash[3];
    // Prefer UK DD/MM/YYYY for agent portals (day > 12 forces UK; month-first only if day part > 12).
    if (a > 12 && b <= 12) {
      return { y: y, m: String(b).padStart(2, "0"), d: String(a).padStart(2, "0") };
    }
    if (b > 12 && a <= 12) {
      return { y: y, m: String(a).padStart(2, "0"), d: String(b).padStart(2, "0") };
    }
    // Ambiguous: assume UK DD/MM/YYYY (target portals are UK universities).
    return {
      y: y,
      m: String(b).padStart(2, "0"),
      d: String(a).padStart(2, "0"),
    };
  }
  return null;
}

/**
 * Format CRM values for UK university portal field types.
 * - input[type=date] → YYYY-MM-DD
 * - text/tel fields that look like DOB → DD/MM/YYYY
 * @param {Element} el
 * @param {string} value
 * @param {{label?:string,name?:string,id?:string}} [meta]
 * @returns {string}
 */
function formatValueForField(el, value, meta) {
  if (!value || typeof value !== "string") return value;
  var type = (el.getAttribute("type") || "text").toLowerCase();
  // Include nearby form-element help text (e.g. Sunderland "Format: 31 Dec 2024")
  var nearby = "";
  try {
    var host = el.closest && (el.closest(".slds-form-element") || el.closest("lightning-input") || el.parentElement);
    if (host && host.innerText) nearby = host.innerText.slice(0, 200);
  } catch (e) { /* ignore */ }
  var hint = normalize(
    [
      (meta && meta.label) || "",
      (meta && meta.name) || "",
      (meta && meta.id) || "",
      el.getAttribute("placeholder") || "",
      el.name || "",
      nearby,
    ].join(" ")
  );
  // Sunderland Academic/Employment: "Month Year From/To" → MM-YYYY
  var isMonthYear =
    /\bmonth year\b/.test(hint) ||
    /\b(from|to) month year\b/.test(hint) ||
    (/\b(start|end|from|to)\b/.test(hint) && /\b(month|year)\b/.test(hint) && !/\b(date of birth|dob|birth|start year|end year)\b/.test(hint));

  // Ulster education: Start Year / End Year are year-only <select>s
  var isYearOnly =
    /\bstart year\b|\bend year\b|\bstudy start year\b|\bstudy end year\b|\bgraduation year\b|\byear of graduation\b/.test(hint) ||
    /start_year|end_year|pickist_start_year|picklist_start_year|picklist_end_year/i.test(
      (meta && meta.name) || el.name || ""
    );

  var isBirth =
    /\b(dob|date of birth|birth date|birthdate)\b/.test(hint) ||
    /^(birthdate|dateofbirth)$/i.test(el.name || "");

  var isDateHint =
    type === "date" ||
    type === "datetime-local" ||
    isMonthYear ||
    isYearOnly ||
    isBirth ||
    /\b(passport (issue|expiry)|expiry date|issue date|test date|start date|end date)\b/.test(hint);

  if (!isDateHint && type !== "date" && type !== "datetime-local") {
    return value;
  }

  // Year-only picklist: ISO / UK dates → "2021"
  if (isYearOnly) {
    var yOnly = String(value).trim().match(/(\d{4})/);
    if (yOnly) return yOnly[1];
  }

  // Already MM-YYYY / MM/YYYY / Mon YYYY → normalise to MM-YYYY for Sunderland
  if (isMonthYear) {
    var my = value.trim().match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (my) return my[1].padStart(2, "0") + "-" + my[2];
    var isoMy = value.trim().match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
    if (isoMy) return isoMy[2].padStart(2, "0") + "-" + isoMy[1];
    var mon = value.trim().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-\/]+(\d{4})$/i);
    if (mon) {
      var months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };
      var m = months[mon[1].toLowerCase().slice(0, 3)] || months[mon[1].toLowerCase()];
      if (m) return m + "-" + mon[2];
    }
  }

  var parts = parseDateParts(value);
  if (!parts) return value;

  if (isMonthYear) {
    return parts.m + "-" + parts.y;
  }
  if (type === "date") {
    return parts.y + "-" + parts.m + "-" + parts.d;
  }
  if (type === "datetime-local") {
    return parts.y + "-" + parts.m + "-" + parts.d + "T00:00";
  }
  // Sunderland Your details Birth Date: "Format: 31 Dec 2024" → "6 Jan 2003"
  var wantsMonDay =
    isBirth &&
    (/\bformat\b/.test(hint) && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(hint) ||
      /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b/.test(hint) ||
      /birthdate/i.test(el.name || ""));
  if (wantsMonDay) {
    var monNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var mi = parseInt(parts.m, 10) - 1;
    if (mi >= 0 && mi < 12) {
      return String(parseInt(parts.d, 10)) + " " + monNames[mi] + " " + parts.y;
    }
  }
  // Default UK text date fields (e:Vision etc.)
  return parts.d + "/" + parts.m + "/" + parts.y;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function waitMs(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Set the value of a form element.
 * Dispatches input and change events so JS frameworks react.
 *
 * Uses the correct prototype setter for each element type:
 *   - HTMLTextAreaElement.prototype.value for <textarea>
 *   - HTMLInputElement.prototype.value for <input>
 * This ensures React/Angular/Vue detect the change.
 *
 * Lightning comboboxes are async (waits for option list).
 *
 * @param {Element} el
 * @param {string} value
 * @param {{label?:string,name?:string,id?:string,crmKey?:string}} [meta]
 * @returns {Promise<boolean>} true if value was set / option selected
 */
var SPLIT_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Parse an ISO / DD/MM/YYYY date, "September 2019", or a bare year into {y, m, d} parts. */
function splitDateParts(raw) {
  var full = parseDateParts(raw);
  if (full) return full;
  var text = String(raw || "").trim();
  var monthYear = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    var month = SPLIT_MONTHS.findIndex(function (name) { return name.slice(0, 3) === monthYear[1].toLowerCase().slice(0, 3); });
    if (month >= 0) return { y: monthYear[2], m: String(month + 1).padStart(2, "0"), d: "" };
  }
  var year = text.match(/^(\d{4})$/);
  return year ? { y: year[1], m: "", d: "" } : null;
}

function splitDateOption(select, part, kind) {
  var number = String(parseInt(part, 10));
  var wanted = [part, number];
  if (kind === "month") wanted.push(SPLIT_MONTHS[number - 1], SPLIT_MONTHS[number - 1].slice(0, 3));
  wanted = wanted.map(function (value) { return String(value).toLowerCase(); });
  return Array.from(select.options).find(function (option) {
    return wanted.indexOf(String(option.value).trim().toLowerCase()) >= 0 ||
      wanted.indexOf(String(option.textContent).trim().toLowerCase()) >= 0;
  }) || null;
}

/**
 * The select a split-date spec names: the first match on the page.
 */
function splitDateSelect(selector) {
  return document.querySelector(selector);
}

/**
 * Fill day / month / year selects declared by the portal for this page.
 * Generic matching never touches these selects (portals block them), because ids such as
 * Greenwich #bday_* mean date of birth on one page and employment start on another.
 */
function fillSplitDates(fieldMap, filled) {
  var specs = (ACTIVE_PORTAL && ACTIVE_PORTAL.splitDates) || [];
  var here = location.pathname + location.search;
  specs.forEach(function (spec) {
    var onPage = new RegExp(spec.page).test(here);
    var parts = splitDateParts(fieldMap[spec.key]);
    if (!parts) return;
    [["day", parts.d], ["month", parts.m], ["year", parts.y]].forEach(function (entry) {
      var selector = spec[entry[0]];
      if (!selector || !entry[1]) return;
      var select = splitDateSelect(selector);
      if (!select || select.tagName !== "SELECT" || select.disabled) return;
      // A page reached by saving the previous one keeps that save's address, so the form it posts to
      // says which screen this is.
      if (!onPage && !(spec.form && select.form && new RegExp(spec.form).test(select.form.action))) return;
      var current = select.options[select.selectedIndex];
      var placeholder = !select.value || (select.selectedIndex === 0 &&
        /^(month|year|day|select\b.*|choose\b.*|-+|)$/i.test(String(current && current.textContent || "").trim()));
      if (!placeholder) return;
      var option = splitDateOption(select, entry[1], entry[0]);
      if (option && applySelectOption(select, option)) {
        filled.push({ name: spec.key, value: entry[1], fieldName: select.id || select.name || "", fieldLabel: entry[0], score: 1000, matchReason: "Split date" });
      }
    });
  });
}

/**
 * Apply a selected option on a native <select>, including Lightning Flow picklists.
 * Uses the native value setter so LWC / Flow state updates (Ulster QA).
 * @param {HTMLSelectElement} el
 * @param {HTMLOptionElement} opt
 * @returns {boolean}
 */
function applySelectOption(el, opt) {
  if (!el || !opt) return false;
  try {
    opt.selected = true;
    el.selectedIndex = opt.index;
    var desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (desc && desc.set) desc.set.call(el, opt.value);
    else el.value = opt.value;
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    try {
      var root = el.getRootNode && el.getRootNode();
      if (root && root.host) {
        root.host.dispatchEvent(new CustomEvent("change", {
          detail: { value: opt.value },
          bubbles: true,
          composed: true,
        }));
      }
    } catch (eHost) { /* ignore */ }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Select a radio in a group by CRM value (Yes/No, Self Funding, etc.).
 * Ulster QA uses radios for Fee Payment Method and previous-apply questions.
 * @param {HTMLInputElement} el - one radio in the group (matched by label)
 * @param {string} value
 * @param {string} [crmKey]
 * @returns {boolean}
 */
function setRadioGroupValue(el, value, crmKey) {
  if (!el || el.type !== "radio") return false;
  var name = el.name;
  var radios = [];
  if (name) {
    try {
      radios = Array.prototype.slice.call(
        document.querySelectorAll('input[type="radio"][name="' + CSS.escape(name) + '"]')
      );
    } catch (e0) {
      radios = Array.prototype.slice.call(document.getElementsByName(name)).filter(function (r) {
        return r.type === "radio";
      });
    }
  }
  // Also search closed shadows for same name
  if (!radios.length || radios.length < 2) {
    var deep = querySelectorAllDeep('input[type="radio"]');
    for (var d = 0; d < deep.length; d++) {
      if (name && deep[d].name === name) radios.push(deep[d]);
    }
  }
  if (!radios.length) radios = [el];

  var candidates = expandComboboxCandidates(crmKey || "", value);
  if (!portalValueMap(crmKey || "", value)) candidates.unshift(value);
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < radios.length; i++) {
    var r = radios[i];
    var label = (
      r.getAttribute("aria-label") ||
      r.value ||
      ""
    ).replace(/\s+/g, " ").trim();
    // Nearby text label (Ulster Lightning radio often has text on parent, not aria-label)
    try {
      var labEl = r.closest("label") || (r.id && document.querySelector('label[for="' + CSS.escape(r.id) + '"]'));
      if (labEl && labEl.innerText) {
        label = (labEl.innerText || label).replace(/\s+/g, " ").trim();
      } else if (r.parentElement && r.parentElement.innerText) {
        var pt = r.parentElement.innerText.replace(/\s+/g, " ").trim();
        if (pt && pt.length < 80) label = pt;
      }
      // Lightning radio group: sibling span/label
      if ((!labEl || !labEl.innerText) && r.nextElementSibling) {
        var sib = (r.nextElementSibling.innerText || r.nextElementSibling.textContent || "").replace(/\s+/g, " ").trim();
        if (sib && sib.length < 60) label = sib;
      }
    } catch (e1) { /* ignore */ }
    for (var c = 0; c < candidates.length; c++) {
      var sc = scoreComboboxOption(normalize(candidates[c]), label);
      // also score raw value attribute
      sc = Math.max(sc, scoreComboboxOption(normalize(candidates[c]), r.value || ""));
      if (sc > bestScore) {
        bestScore = sc;
        best = r;
      }
    }
  }
  if (!best || bestScore < 55) return false;
  try {
    if (!safeClick(best, "radio")) return false;
    best.checked = true;
    best.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    best.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  } catch (e2) {
    return false;
  }
}

async function setElementValue(el, value, meta) {
  var tagName = el.tagName.toLowerCase();
  var type = (el.getAttribute("type") || "text").toLowerCase();
  var crmKey = (meta && meta.crmKey) || "";
  value = formatValueForField(el, value, meta || {});

  // A portal value map is authoritative: a CRM value it omits writes nothing to any control.
  var mappedOptions = portalValueMap(crmKey, value);
  if (mappedOptions && !mappedOptions.length) return false;

  // National phone digits only when filling Ulster Phone/Mobile (country code separate)
  if ((!ACTIVE_PORTAL || ACTIVE_PORTAL.phoneKeepsDialPrefix) &&
    (crmKey === "phone" || crmKey === "emergencyPhone") && (type === "tel" || type === "text")) {
    // No country-code field: UK numbers go national (07...), others keep +CC.
    var intlPhone = String(value).trim().replace(/^00/, "+").replace(/[^\d+]/g, "");
    value = intlPhone.indexOf("+44") === 0 ? "0" + intlPhone.slice(3).replace(/^0/, "") : intlPhone;
  } else if ((crmKey === "phone" || crmKey === "emergencyPhone") && (type === "tel" || type === "text")) {
    var rawPhone = String(value).trim();
    if (rawPhone.indexOf("+44") === 0) rawPhone = rawPhone.slice(3);
    else if (/^0044/.test(rawPhone)) rawPhone = rawPhone.slice(4);
    value = rawPhone.replace(/[^\d]/g, "");
    // Strip country code 44 if CRM stored 4477… (12+ digits)
    if (value.indexOf("44") === 0 && value.length >= 12) value = value.slice(2);
  }

  // Skip checkbox for MVP. Radios supported for Ulster Yes/No + fee method.
  if (type === "checkbox") {
    return false;
  }
  if (type === "radio") {
    return setRadioGroupValue(el, value, crmKey);
  }

  if (tagName === "select") {
    function isPlaceholderOption(o) {
      var t = o.text.trim().toLowerCase();
      return !o.value || o.value === "" ||
        /none|blank|implicit|defaulttext/.test(o.value.toLowerCase()) ||
        /^[\u2014\u2013\u2012-]/.test(t) ||
        /^(select|choose|pick|please|--none--)/.test(t);
    }

    // Unmapped portals: exact normalized value/label or a small explicit equivalence only.
    // Never fall through to the legacy fuzzy scorer.
    if (!ACTIVE_PORTAL) {
      var exactOpt = matchGenericSelectOption(el, value, crmKey, isPlaceholderOption);
      return exactOpt ? applyGenericSelectOption(el, exactOpt) : false;
    }

    var options = Array.from(el.options);
    var candidates = expandComboboxCandidates(crmKey, value);
    if (!portalValueMap(crmKey, value) && candidates.indexOf(value.trim()) === -1) candidates.unshift(value.trim());

    var bestOpt = null;
    var bestSc = 0;
    for (var oi = 0; oi < options.length; oi++) {
      if (isPlaceholderOption(options[oi])) continue;
      var ot = options[oi].text.trim();
      var ov = options[oi].value || "";
      for (var ci = 0; ci < candidates.length; ci++) {
        var sc1 = scoreComboboxOption(normalize(candidates[ci]), ot);
        var sc2 = scoreComboboxOption(normalize(candidates[ci]), ov);
        var sc = Math.max(sc1, sc2);
        if (sc > bestSc) {
          bestSc = sc;
          bestOpt = options[oi];
        }
      }
    }
    if (bestOpt && bestSc >= 55) {
      return applySelectOption(el, bestOpt);
    }

    return false; // no matching option
  }

  if (tagName === "textarea") {
    var nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    );
    if (nativeTextAreaSetter && nativeTextAreaSetter.set) {
      nativeTextAreaSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Input elements (text, tel, email, url, number, date, search/combobox, etc.)
  if (tagName === "input") {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    // Standard events (minimal set that frameworks need)
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Salesforce Experience Cloud comboboxes (type=search / aria-autocomplete list):
    // Ulster phone country code uses role=textbox + aria-autocomplete=list
    var isSearch =
      type === "search" ||
      el.getAttribute("role") === "combobox" ||
      el.getAttribute("aria-autocomplete") === "list";
    if (isSearch) {
      try {
        el.focus();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      } catch (e3) { /* ignore */ }
      var picked = await pickLightningComboboxOption(el, value, meta && meta.crmKey);
      // Honest success: combobox only counts if a real option was selected
      if (!picked) {
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        return false;
      }
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      try {
        var rootCb = el.getRootNode && el.getRootNode();
        if (rootCb && rootCb.host) {
          rootCb.host.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (eHost) { /* ignore */ }
      return true;
    }

    el.dispatchEvent(new Event("blur", { bubbles: true }));
    // Notify host lightning-input of value change when inside open shadow
    try {
      var root = el.getRootNode && el.getRootNode();
      if (root && root.host) {
        root.host.value = value;
        root.host.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (e2) { /* ignore */ }
    return true;
  }

  // Fallback (unusual element types)
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/**
 * Option text the active portal declares for a CRM value (`valueMaps`), or null when the
 * portal has no map for the key. A mapped key offers only these options; a CRM value
 * the map omits offers none, so the control stays for staff.
 * @param {string} crmKey
 * @param {string} value
 * @returns {string[]|null}
 */
function portalValueMap(crmKey, value) {
  var maps = ACTIVE_PORTAL && ACTIVE_PORTAL.valueMaps;
  if (!maps || !maps[crmKey]) return null;
  var byValue = maps[crmKey];
  var wanted = normalize(value);
  return Object.prototype.hasOwnProperty.call(byValue, wanted) ? byValue[wanted].slice() : [];
}

/**
 * Expand a CRM value into portal combobox candidates (UK HE / Sunderland).
 * Tried in order; first that matches a live option wins.
 * @param {string} crmKey
 * @param {string} value
 * @returns {string[]}
 */
function expandComboboxCandidates(crmKey, value) {
  var v = (value || "").trim();
  var portalOptions = portalValueMap(crmKey, v);
  if (portalOptions) return portalOptions;
  var out = [];
  function add(x) {
    if (!x || typeof x !== "string") return;
    var t = x.trim();
    if (!t) return;
    if (out.indexOf(t) === -1) out.push(t);
  }
  add(v);

  if (crmKey === "grade" || crmKey === "gpa") {
    var n = normalize(v);
    // Sunderland live Grade picklist (exact, verified 2026-07-31):
    // First Class | Upper Second | Lower Second | Third Class | Unclassified |
    // Aegrotat | Commendation | Distinction | Merit | Pass | Failed Award | Other
    if (/2\s*:\s*1|two division one|upper second|2\.1|ii\.?i\b|class two division one/.test(n)) {
      add("Upper Second"); // exact Sunderland option, try first
      add("Upper Second Class Honours (2:1)");
      add("Upper Second Class Honours");
      add("Upper Second Class (2:1)");
      add("2:1");
      add("2.1");
      add("Class Two Division One Honours");
      add("Second Class Honours, Upper Division");
      add("Second Class Honours Upper Division");
      add("II.i");
    }
    if (/2\s*:\s*2|two division two|lower second|2\.2|ii\.?ii\b/.test(n)) {
      add("Lower Second"); // exact Sunderland option
      add("Lower Second Class Honours (2:2)");
      add("Lower Second Class Honours");
      add("2:2");
      add("Class Two Division Two Honours");
    }
    if (/first class|1st|first-class|\b1\s*:\s*1\b/.test(n)) {
      add("First Class"); // exact Sunderland option
      add("First Class Honours");
      add("1st");
    }
    if (/third|3rd|\biii\b/.test(n)) {
      add("Third Class"); // exact Sunderland option
      add("Third Class Honours");
    }
    if (/distinction/.test(n)) add("Distinction");
    if (/merit/.test(n)) add("Merit");
    if (/pass/.test(n)) add("Pass");
    if (/unclassified/.test(n)) add("Unclassified");
    if (/aegrotat/.test(n)) add("Aegrotat");
    if (/commendation/.test(n)) add("Commendation");
  }

  // Academic History "Qualification Level" ≠ step-1 "Highest Qualification"
  if (crmKey === "qualificationLevel") {
    var nql = normalize(v);
    // Sunderland Academic History: menu/option is "Higher Education" (verified live)
    if (/higher education|he\b|master|meng|msc|bachelor|beng|bsc|postgrad|undergrad|level\s*[67]|university|degree/.test(nql) || !nql) {
      add("Higher Education");
    }
    if (/further education|\bfe\b/.test(nql)) add("Further Education");
    if (/secondary|school|a\s*level|gcse/.test(nql)) add("Secondary Education");
    // legacy CRM values still expand to HE
    if (/master|meng|level\s*7|pg(t|r)?/.test(nql)) {
      add("Higher Education");
      add("Masters");
      add("Level 7");
    }
  }

  if (crmKey === "highestQualification") {
    var nq = normalize(v);
    if (/master|meng|msc|postgrad|level\s*7|pg(t|r)?|uk masters|higher education/.test(nq)) {
      // Step 1 "Highest Qualification" options on Sunderland Your details:
      add("UK Masters degree");
      add("Non-UK Master degree");
      add("Masters Degree");
      add("Master's Degree");
      add("Masters");
      add("Master");
      add("Postgraduate");
      add("Postgraduate Taught");
      add("Level 7");
    }
    if (/bachelor|beng|bsc|first degree|undergrad|level\s*6/.test(nq)) {
      add("UK First degree");
      add("Non-UK First degree");
      add("Bachelors");
      add("Bachelor's Degree");
      add("Undergraduate");
      add("Level 6");
    }
    if (/foundation|level\s*3|level\s*4/.test(nq)) {
      add("Foundation");
      add("Foundation Degree");
    }
    if (/phd|doctor|level\s*8/.test(nq)) {
      add("Doctorate");
      add("PhD");
      add("Level 8");
    }
  }

  if (crmKey === "qualificationType") {
    var nt = normalize(v);
    // Sunderland live codes: BA (Hons), BSc (Hons), BA, BENG, BENG (Hons), MA, MBA,
    // MENG, MSc, MSci, MPhil, PhD, PGDip, PGCert, … (verified 2026-07-31)
    if (/master of engineering|\bmeng\b/.test(nt)) {
      add("MENG"); // exact Sunderland option
      add("MEng");
      add("Master of Engineering");
      add("Master of Engineering (MENG)");
    }
    if (/master of science|\bmsc\b/.test(nt)) {
      add("MSc");
      add("Master of Science");
    }
    if (/\bma\b|master of arts/.test(nt)) add("MA");
    if (/\bmba\b|master of business/.test(nt)) add("MBA");
    if (/bachelor of engineering|\bbeng\b/.test(nt)) {
      add("BENG");
      add("BENG (Hons)");
      add("BEng");
      add("Bachelor of Engineering");
    }
    if (/\bbsc\b|bachelor of science/.test(nt)) {
      add("BSc (Hons)");
      add("BSc");
    }
    if (/\bba\b|bachelor of arts/.test(nt)) {
      add("BA (Hons)");
      add("BA");
    }
    if (/\bphd\b|doctor/.test(nt)) add("PhD");
  }

  if (crmKey === "awardStatus") {
    var na = normalize(v);
    // Sunderland live: Awarded | Exam to be taken | Pending Award | Still Studying | Not Awarded
    if (/award|complete|pass|confer|finish/.test(na) || !na) {
      add("Awarded");
      add("Completed");
      add("Passed");
      add("Conferred");
      add("Finished");
    }
    if (/pending|expect/.test(na)) {
      add("Pending Award");
      add("Pending");
      add("Expected");
    }
    if (/current|ongoing|studying|still/.test(na)) {
      add("Still Studying");
      add("In Progress");
      add("Current");
    }
    if (/exam|to be taken/.test(na)) add("Exam to be taken");
    if (/not award|fail/.test(na)) add("Not Awarded");
  }

  if (crmKey === "studyCountry" || crmKey === "countryName" || crmKey === "employmentCountry") {
    var nc = normalize(v);
    if (/united kingdom|\buk\b|great britain|england|scotland|wales|britain/.test(nc)) {
      // Ulster education Country select uses short "United Kingdom" (live 2026-07-31)
      add("United Kingdom");
      add("United Kingdom of Great Britain and Northern Ireland (the)");
      add("UK");
      add("Great Britain");
    }
    if (/united arab emirates|\buae\b/.test(nc)) {
      add("United Arab Emirates (the)");
      add("United Arab Emirates");
      add("UAE");
    }
    if (/jordan/.test(nc)) add("Jordan");
    if (/indonesia/.test(nc)) add("Indonesia");
  }

  // Year-only education picklists (and fallbacks from ISO dates)
  if (
    crmKey === "studyStartYear" ||
    crmKey === "studyEndYear" ||
    crmKey === "startDate" ||
    crmKey === "endDate" ||
    crmKey === "graduationYear"
  ) {
    var yMatch = String(v).trim().match(/(\d{4})/);
    if (yMatch) add(yMatch[1]);
  }

  // Ulster Results radios
  if (crmKey === "awardStatus") {
    var nas = normalize(v);
    if (/award|complete|finish|pass|granted|yes/.test(nas) && !/progress|pending|still/.test(nas)) {
      add("Completed");
      add("choice_Result.Completed");
    }
    if (/progress|current|ongoing|still|studying|pending/.test(nas)) {
      add("In Progress");
      add("choice_Result.In Progress");
    }
  }

  // Ulster Education Institution lookup
  if (crmKey === "institutionName") {
    var ni = normalize(v);
    if (/sheffield/.test(ni) && /university|uni/.test(ni)) {
      add("The University of Sheffield");
      add("University of Sheffield");
    }
    if (/other uk|not (on )?(the )?list/.test(ni)) add("Other UK institution");
    if (/other non.?uk|overseas/.test(ni)) add("Other non-UK institution");
  }

  if (crmKey === "funding") {
    var nf = normalize(v);
    if (/self/.test(nf)) {
      // Sunderland live option (ego-browser 2026-07-31): "Self-Funding"
      add("Self-Funding");
      // Ulster QA live radio (ego-browser 2026-07-31): "Self Funding" (no hyphen)
      add("Self Funding");
      add("Self_Funding");
      add("Self-Funded");
      add("Self Funded");
      add("Private");
    }
    if (/sponsor|company|employer/.test(nf)) {
      // Ulster QA live radio: "Sponsorship"
      add("Sponsorship");
      add("Sponsored");
      add("Sponsor");
      add("Company Sponsored");
      add("Employer Sponsored");
    }
    if (/scholar|bursar/.test(nf)) {
      add("Scholarship");
      add("Scholarship / Bursary");
      add("Bursary");
    }
    if (/student loan|loan|slc|sfas/.test(nf)) {
      add("Student Loan");
      add("Student Finance");
    }
    if (/other/.test(nf)) {
      add("Other");
      add("Other funding source");
    }
  }

      // Ulster Title picklist: Mr. (with period), Sunderland uses Mr without period
  if (crmKey === "title") {
    var nt = normalize(v);
    if (/^mr\.?$/.test(nt)) {
      add("Mr.");
      add("Mr");
    }
    if (/^mrs\.?$/.test(nt)) {
      add("Mrs.");
      add("Mrs");
    }
    if (/^ms\.?$/.test(nt)) {
      add("Ms.");
      add("Ms");
    }
    if (/^miss$/.test(nt)) add("Miss");
    if (/^dr\.?$/.test(nt)) {
      add("Dr.");
      add("Dr");
    }
    if (/^mx$/.test(nt)) add("MX");
  }

  // Ulster Sex Identifier / gender
  if (crmKey === "gender") {
    var ng = normalize(v);
    if (/^m(ale)?$/.test(ng)) add("Male");
    if (/^f(emale)?$/.test(ng)) add("Female");
    if (/other/.test(ng)) add("Other");
    if (/refus|prefer not|not say/.test(ng)) {
      add("Information Refused");
      add("Prefer not to say");
    }
  }

  // Ulster Ethnicity (live options include "Any other Asian background")
  if (crmKey === "ethnicity") {
    var ne = normalize(v);
    if (/indonesia|malay|asian|other asian/.test(ne) || !ne) {
      add("Any other Asian background");
    }
    if (/chinese/.test(ne)) add("Asian - Chinese or Chinese British");
    if (/indian/.test(ne)) add("Asian - Indian or Indian British");
    if (/pakistani/.test(ne)) add("Asian - Pakistani or Pakistani British");
    if (/bangladeshi/.test(ne)) add("Asian - Bangladeshi or Bangladeshi British");
    if (/arab/.test(ne)) add("Arab");
    if (/african|black african/.test(ne)) add("Black - African or African British");
    if (/caribbean/.test(ne)) add("Black - Caribbean or Caribbean British");
    if (/white|british|english|irish/.test(ne)) {
      add("White - British, Irish, Northern Irish, English, Scottish or Welsh");
      add("Any other White background");
    }
    if (/prefer not|not say/.test(ne)) add("Prefer not to say");
  }

  // Ulster Dependants
  if (crmKey === "dependants") {
    var nd = normalize(v);
    if (/^no|none|0$|no depend/.test(nd) || !nd) add("No Dependants");
    if (/child|young/.test(nd)) add("Young People/Children");
    if (/relative|friend/.test(nd)) add("Other Relative/Friends");
    if (/both/.test(nd)) add("Both Young people/children & Other relative/friends");
    if (/prefer not/.test(nd)) add("Prefer not to say");
  }

  // Ulster Current Domicile / nationality-style country lists
  if (crmKey === "currentDomicile" || crmKey === "nationality") {
    var ndom = normalize(v);
    if (/indonesia/.test(ndom)) add("Indonesia");
    if (/united kingdom|\buk\b|britain|england/.test(ndom)) {
      add("United Kingdom");
      add("United Kingdom of Great Britain and Northern Ireland (the)");
    }
    if (/united arab|\buae\b/.test(ndom)) {
      add("United Arab Emirates");
      add("United Arab Emirates (the)");
    }
  }

  // Ulster phone country code lookup: "United Kingdom (+44)"
  if (crmKey === "phoneCountryCode" || crmKey === "emergencyPhoneCountryCode") {
    var ncc = normalize(v);
    if (/united kingdom|\buk\b|\+?44|britain/.test(ncc) || !ncc) {
      add("United Kingdom (+44)");
      add("United Kingdom");
      add("+44");
    }
    if (/indonesia|\+?62/.test(ncc)) {
      add("Indonesia (+62)");
      add("Indonesia");
      add("+62");
    }
    if (/united arab|\buae\b|\+?971/.test(ncc)) {
      add("United Arab Emirates (UAE) (+971)");
      add("United Arab Emirates");
      add("+971");
    }
    if (/united states|\busa\b|\+?1\b/.test(ncc)) {
      add("United States (+1)");
      add("United States");
    }
  }

  // Ulster Employment Occupation SOC lookup (live 2026-07-31: typed "Software" →
  // "Programmers and Software Development Professionals")
  if (crmKey === "occupation" || crmKey === "cvCurrentJobTitle" || crmKey === "jobTitle") {
    var noc = normalize(v);
    if (/software|programmer|developer|engineer|coding|full.?stack|react|ios|web/.test(noc)) {
      add("Programmers and Software Development Professionals");
      add("Software Developer");
      add("Software Engineer");
    }
    if (/intern/.test(noc) && /software|engineer|developer/.test(noc)) {
      add("Programmers and Software Development Professionals");
    }
    if (/data scientist|machine learning|ai engineer/.test(noc)) {
      add("Programmers and Software Development Professionals");
      add("Data Scientists");
    }
    if (/manager|management/.test(noc) && !/software/.test(noc)) {
      add("Managers and Directors");
    }
    if (/teacher|lecturer|tutor/.test(noc)) {
      add("Teaching Professionals");
    }
    if (/nurse|medical|doctor|clinical/.test(noc)) {
      add("Health Professionals");
    }
  }

        // Ulster NEW NOMINATED CONTACT: Relationship To You? radios (live 2026-07-31)
  // Options: Parent · Guardian · Host · Grandparent · Spouse · Sibling · Other · Next of Kin
  if (crmKey === "emergencyRelationship") {
    var nr = normalize(v);
    if (/parent|mother|father|mum|mom|dad/.test(nr)) {
      add("Parent");
      add("parentPicklist");
    }
    if (/guardian/.test(nr)) {
      add("Guardian");
      add("guardianPicklist");
    }
    if (/host/.test(nr)) {
      add("Host");
      add("hostPicklist");
    }
    if (/grandparent|grandmother|grandfather/.test(nr)) {
      add("Grandparent");
      add("choice_Grandparent");
    }
    if (/spouse|wife|husband|partner/.test(nr)) {
      add("Spouse");
      add("choice_Spouse");
    }
    if (/sibling|brother|sister/.test(nr)) {
      add("Sibling");
      add("choice_Sibling");
    }
    if (/next of kin|nextofkin|kin/.test(nr)) {
      add("Next of Kin");
      add("choice_NextofKin");
    }
    if (/other|family|relative|friend/.test(nr) && !/parent|guardian|host|grand|spouse|sibling|kin/.test(nr)) {
      add("Other");
      add("choice_Other");
    }
        // CRM often stores "Family" / "Relative", prefer Parent for demo family contact
    if (/^family$|^relative$/.test(nr)) {
      add("Parent");
      add("Next of Kin");
      add("Other");
    }
  }

  // Yes/No radios (Ulster previous apply / previous name, Sunderland hasUniversityDegree)
  if (
    crmKey === "hasUniversityDegree" ||
    crmKey === "hasTwoYearsWorkExperience" ||
    crmKey === "previouslyApplied" ||
    crmKey === "previousName" ||
    crmKey === "englishFirstLanguage"
  ) {
    var ny = normalize(v);
    if (/^(y|yes|true|1)$/.test(ny) || (/yes|have|hold/.test(ny) && !/no/.test(ny))) {
      add("Yes");
    }
    if (/^(n|no|false|0)$/.test(ny) || /^no\b/.test(ny)) {
      add("No");
    }
  }

  return out;
}

/**
 * Score how well a CRM candidate string matches a combobox option label.
 * Prefers pre-normalized candidate when provided.
 * @param {string} candidateNorm - already normalized candidate
 * @param {string} optionText
 * @param {string[]} [candidateTokens]
 * @returns {number}
 */
function scoreComboboxOption(candidateNorm, optionText, candidateTokens) {
  var c = candidateNorm;
  var t = normalize(optionText);
  if (!c || !t || t === "no option found." || t === "no matches found.") return 0;
  if (t === c) return 100;
  // digit-aware: "2:1" vs "2.1" vs "2 1"
  var cDigits = c.replace(/[^a-z0-9]/g, "");
  var tDigits = t.replace(/[^a-z0-9]/g, "");
  if (cDigits.length >= 2 && cDigits === tDigits) return 95;
  if (t.startsWith(c) || c.startsWith(t)) return 85;
  if (t.includes(c) || c.includes(t)) return 70;
  // token overlap
  var cTok = candidateTokens || c.split(/\s+/).filter(function (w) { return w.length > 1; });
  var tSet = new Set(t.split(/\s+/));
  var hits = 0;
  for (var i = 0; i < cTok.length; i++) if (tSet.has(cTok[i])) hits++;
  if (cTok.length && hits / cTok.length >= 0.6) return 55 + Math.round((hits / cTok.length) * 20);
  return 0;
}

/**
 * Collect option elements scoped to the open combobox near inputEl.
 * Avoids whole-document walks over thousands of Sunderland picklist nodes.
 * @param {Element} inputEl
 * @returns {Element[]}
 */
function getScopedComboboxOptions(inputEl) {
  var out = [];
  var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function addOpts(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll(
      "[role='option'], lightning-base-combobox-item, .slds-listbox__option"
    );
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (seen) {
        if (seen.has(n)) continue;
        seen.add(n);
      }
      // Prefer visible options
      try {
        var r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
      } catch (e) { /* keep */ }
      out.push(n);
    }
  }

  function walkShadow(root, depth) {
    if (!root || depth > 8) return;
    addOpts(root);
    try {
      var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (var j = 0; j < all.length; j++) {
        if (all[j].shadowRoot) walkShadow(all[j].shadowRoot, depth + 1);
      }
    } catch (e2) { /* ignore */ }
  }

  // 1. aria-controls / aria-owns on input or host
  var controlledIds = [];
  try {
    var hosts = [inputEl];
    var rn = inputEl.getRootNode && inputEl.getRootNode();
    if (rn && rn.host) hosts.push(rn.host);
    for (var h = 0; h < hosts.length; h++) {
      var el = hosts[h];
      if (!el || !el.getAttribute) continue;
      var ac = el.getAttribute("aria-controls") || el.getAttribute("aria-owns") || "";
      if (ac) {
        ac.split(/\s+/).forEach(function (id) {
          if (id) controlledIds.push(id);
        });
      }
    }
  } catch (e3) { /* ignore */ }

  for (var c = 0; c < controlledIds.length; c++) {
    var byId = null;
    var cid = controlledIds[c];
    try {
      byId = document.getElementById(cid);
    } catch (e4) { /* ignore */ }
    if (!byId) {
      // Search in open shadows for id
      var esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(cid)
          : String(cid).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      try {
        var deepId = querySelectorAllDeep("#" + esc);
        if (deepId[0]) byId = deepId[0];
      } catch (e4b) { /* ignore */ }
    }
    if (byId) walkShadow(byId, 0);
  }

  // 2. Nearest lightning-combobox / slds-combobox host
  if (!out.length) {
    var node = inputEl;
    for (var d = 0; d < 12 && node; d++) {
      var tag = (node.tagName || "").toLowerCase();
      if (
        tag === "lightning-combobox" ||
        tag === "lightning-base-combobox" ||
        (node.classList && (node.classList.contains("slds-combobox") || node.classList.contains("slds-form-element")))
      ) {
        walkShadow(node, 0);
        if (node.shadowRoot) walkShadow(node.shadowRoot, 0);
        if (out.length) break;
      }
      try {
        var rootN = node.getRootNode && node.getRootNode();
        if (rootN && rootN.host) node = rootN.host;
        else node = node.parentElement;
      } catch (e5) {
        node = node.parentElement;
      }
    }
  }

  // 3. Visible listboxes only (not whole-document option dump)
  if (!out.length) {
    var listboxes = querySelectorAllDeep("[role='listbox'], .slds-listbox, .slds-dropdown");
    for (var lb = 0; lb < listboxes.length; lb++) {
      try {
        var rect = listboxes[lb].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) walkShadow(listboxes[lb], 0);
      } catch (e6) { /* ignore */ }
    }
  }

  // 4. Last resort: visible options only (never score display:none catalog dumps)
  if (!out.length) {
    var any = querySelectorAllDeep(
      "[role='option'], lightning-base-combobox-item, .slds-listbox__option"
    );
    for (var a = 0; a < any.length; a++) {
      try {
        var rr = any[a].getBoundingClientRect();
        if (rr.width > 0 && rr.height > 0) out.push(any[a]);
      } catch (e7) { /* ignore */ }
    }
  }

  return out;
}

/**
 * After typing into a Lightning combobox search input, click the best matching option.
 * Options are scoped to the open listbox (not the whole document).
 * Waits briefly for async Lightning rendering.
 * @param {Element} inputEl
 * @param {string} value
 * @param {string} [crmKey]
 * @returns {Promise<boolean>}
 */
async function pickLightningComboboxOption(inputEl, value, crmKey) {
  var candidates = expandComboboxCandidates(crmKey || "", value);
  if (!candidates.length) return false;

  // Pre-normalize candidates once
  var candMeta = candidates.map(function (raw) {
    var n = normalize(raw);
    return {
      raw: raw,
      norm: n,
      tokens: n.split(/\s+/).filter(function (w) { return w.length > 1; }),
    };
  });

  // Filter input with best candidate text to shrink Lightning's async list
  try {
    var filterText = candidates[0];
    var setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    if (setter && setter.set) setter.set.call(inputEl, filterText);
    else inputEl.value = filterText;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.focus();
    inputEl.click();
  } catch (e0) { /* ignore */ }

  var options = [];
  var attempts = 8;
  for (var attempt = 0; attempt < attempts; attempt++) {
    options = getScopedComboboxOptions(inputEl);
    if (options.length > 0) break;
    await waitMs(40 + attempt * 35);
    try {
      inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    } catch (e1) { /* ignore */ }
  }
  if (!options.length) return false;

  // Exact-label index first (O(O) once), then fuzzy only if needed
  var exactMap = Object.create(null);
  var optionTexts = [];
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    var text = (
      opt.getAttribute("data-value") ||
      opt.getAttribute("title") ||
      opt.textContent ||
      ""
    ).replace(/\s+/g, " ").trim();
    optionTexts.push(text);
    var tn = normalize(text);
    if (tn && !exactMap[tn]) exactMap[tn] = { opt: opt, text: text };
  }

  var best = null;
  var bestScore = 0;
  var bestCandidate = "";

  for (var c = 0; c < candMeta.length; c++) {
    var cm = candMeta[c];
    if (exactMap[cm.norm]) {
      best = exactMap[cm.norm].opt;
      bestScore = 100;
      bestCandidate = cm.raw;
      break;
    }
  }

  if (bestScore < 100) {
    for (var oi = 0; oi < options.length; oi++) {
      var otext = optionTexts[oi];
      if (!otext || /no option found|no matches found|stage complete|stage not started/i.test(otext)) {
        continue;
      }
      for (var cj = 0; cj < candMeta.length; cj++) {
        var sc = scoreComboboxOption(candMeta[cj].norm, otext, candMeta[cj].tokens);
        if (sc > bestScore) {
          bestScore = sc;
          best = options[oi];
          bestCandidate = candMeta[cj].raw;
        }
      }
      if (bestScore >= 100) break;
    }
  }

  if (best && bestScore >= 55) {
    try {
      if (bestCandidate) {
        var setter2 = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        );
        if (setter2 && setter2.set) setter2.set.call(inputEl, bestCandidate);
        else inputEl.value = bestCandidate;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e2) { /* ignore */ }
    try {
      return safeClick(best, "option");
    } catch (e3) {
      try {
        if (!safeClick(best, "option")) return false;
        return true;
      } catch (e4) {
        return false;
      }
    }
  }
  return false;
}

// ─── Autofill logic ─────────────────────────────────────────────────────

// CRM keys the CRM never sends, built from the ones it does. Staff chose these pairings:
// birth country follows nationality, country of residence follows the address country,
// and the programme intake is the CRM's start month and year.
var DERIVED_KEYS = {
  countryOfBirth: function (map) { return map.nationality; },
  currentDomicile: function (map) { return map.countryName; },
  preferredIntake: function (map) {
    return map.preferredStartMonth && map.preferredStartYear
      ? String(map.preferredStartMonth).trim() + " " + String(map.preferredStartYear).trim()
      : "";
  },
};

/**
 * Add each derived key the CRM lacks, but only when the active portal maps it, so a key
 * never reaches label matching on a portal that has no control for it.
 */
function withDerivedKeys(fieldMap) {
  var mapped = Object.keys(ACTIVE_PORTAL.selectorOverrides || {})
    .concat((ACTIVE_PORTAL.splitDates || []).map(function (spec) { return spec.key; }));
  var derived = {};
  Object.keys(DERIVED_KEYS).forEach(function (key) {
    if (mapped.indexOf(key) === -1 || String(fieldMap[key] || "").trim()) return;
    var value = String(DERIVED_KEYS[key](fieldMap) || "").trim();
    if (value) derived[key] = value;
  });
  return Object.keys(derived).length ? Object.assign({}, fieldMap, derived) : fieldMap;
}

/**
 * Match CRM keys to form fields using heuristic scoring, then fill them.
 * Precomputes field match meta once; tries next empty candidate if best is filled.
 *
 * @param {Record<string,string>} fieldMap - CRM key → value
 * @param {Array} fields - detected form fields (from scanFormFields)
 * @returns {Promise<{filled:Array, skippedEmpty:Array, skippedExisting:Array, skippedSelect:Array, unmatched:string[]}>}
 */
async function autofillPage(fieldMap, fields) {
  if (!ACTIVE_PORTAL) return autofillGeneric(fieldMap, fields);
  fieldMap = withDerivedKeys(fieldMap);

  /** @type {Array<{name:string,value:string,fieldName:string,fieldLabel:string,score:number,matchReason:string}>} */
  var filled = [];

  /** @type {Array<{name:string,reason:string}>} */
  var skippedEmpty = [];

  /** @type {Array<{name:string,fieldName:string,fieldLabel:string,existingValue:string,reason:string}>} */
  var skippedExisting = [];

  /** @type {Array<{name:string,reason:string}>} */
  var skippedSelect = [];

  /** @type {string[]} */
  var unmatched = [];

  /** @type {Set<Element>} */
  var usedElements = new Set();

  warmSynonymCaches();
  precomputeFieldMatchMeta(fields);

  var entries = Object.entries(fieldMap);
  for (var e = 0; e < entries.length; e++) {
    var crmKey = entries[e][0];
    var value = entries[e][1];

    // Skip empty CRM values
    if (!value || (typeof value === "string" && !value.trim())) {
      skippedEmpty.push({ name: crmKey, reason: "Empty CRM value" });
      continue;
    }

    // Score every unused field once; sort descending for fallthrough
    var ranked = [];
    for (var f = 0; f < fields.length; f++) {
      if (usedElements.has(fields[f].element)) continue;
      var identifier = fields[f]._identifier || getFieldIdentifier(fields[f]);
      var terminalToken = fields[f]._terminalToken != null
        ? fields[f]._terminalToken
        : getTerminalToken(fields[f].name);
      var sectionKind = fields[f]._sectionKind != null
        ? fields[f]._sectionKind
        : getSectionKind(fields[f]);
      var score = fields[f].overrideCrmKey
        ? (fields[f].overrideCrmKey === crmKey ? 1000 : 0)
        : matchScore(
        crmKey,
        identifier,
        fields[f].autocomplete,
        terminalToken,
        sectionKind
        );
      if (score >= 50) {
        ranked.push({ field: fields[f], score: score });
      }
    }
    ranked.sort(function (a, b) { return b.score - a.score; });

    if (!ranked.length) {
      unmatched.push(crmKey);
      continue;
    }

    var didFill = false;
    var notedExisting = false;
    // Ulster Contact: one CRM phone value fills both Phone + Mobile (and both country codes)
    var multiFill =
      crmKey === "phone" ||
      crmKey === "phoneCountryCode" ||
      crmKey === "email" ||
      crmKey === "emergencyPhone" ||
      crmKey === "emergencyPhoneCountryCode";

    for (var r = 0; r < ranked.length; r++) {
      var cand = ranked[r];
      var bestField = cand.field;
      var bestScore = cand.score;
      var existingVal = bestField.element.value || "";
      var elType = (bestField.type || bestField.element.getAttribute("type") || "").toLowerCase();
      // Radios: treat as filled only when a choice in the group is checked
      if (elType === "radio") {
        existingVal = bestField.hasValue || bestField.element.checked ? "checked" : "";
      }

      // Skip non-empty; try next empty candidate (e.g. countryName → residence)
      if (existingVal.trim()) {
        // A portal override target or a field already holding this value means the key is done;
        // falling through would copy the value into a second field on repeat Autofill.
        var selectedText = bestField.element.tagName === "SELECT" && bestField.element.selectedOptions && bestField.element.selectedOptions[0]
          ? bestField.element.selectedOptions[0].textContent || ""
          : "";
        var satisfied = bestField.overrideCrmKey === crmKey ||
          normalize(existingVal) === normalize(String(value)) ||
          (selectedText && normalize(selectedText) === normalize(String(value)));
        if (!notedExisting) {
          skippedExisting.push({
            name: crmKey,
            fieldName: bestField.name || bestField.id || "",
            fieldLabel: bestField.label || "",
            existingValue: truncate(existingVal, 30),
            reason: "Field already has a value",
          });
          notedExisting = true;
        }
        if (satisfied && !multiFill) break;
        continue;
      }

      // The page may have disabled, hidden, or locked the control since the scan.
      if (!isFillable(bestField.element)) continue;
      var success = await setElementValue(bestField.element, value, {
        label: bestField.label,
        name: bestField.name,
        id: bestField.id,
        crmKey: crmKey,
      });
      if (success) {
        usedElements.add(bestField.element);
        // Mark whole radio group used so Yes+No don't double-claim CRM keys
        if (elType === "radio" && bestField.element.name) {
          for (var uf = 0; uf < fields.length; uf++) {
            if (
              fields[uf].element &&
              fields[uf].element.type === "radio" &&
              fields[uf].element.name === bestField.element.name
            ) {
              usedElements.add(fields[uf].element);
            }
          }
        }
        var matchReason = "";
        if (bestScore >= 100) matchReason = "Exact synonym match";
        else if (bestScore >= 85) matchReason = "Strong prefix/suffix match";
        else if (bestScore >= 65) matchReason = "Substring match";
        else matchReason = "Combined signals match";

        filled.push({
          name: crmKey,
          value: truncate(value, 30),
          fieldName: bestField.name || bestField.id || "",
          fieldLabel: bestField.label || "",
          score: bestScore,
          matchReason: matchReason,
        });
        didFill = true;
        if (!multiFill) break;
        // multiFill: continue to next ranked empty field (Phone + Mobile)
      } else {
        skippedSelect.push({
          name: crmKey,
          reason: "Could not match select/combobox option",
        });
        // try next ranked field
      }
    }

    if (!didFill && !notedExisting && skippedSelect.every(function (s) { return s.name !== crmKey; })) {
      unmatched.push(crmKey);
    }
  }

  // Combine all skipped for backward compatibility
  var skippedAll = [].concat(
    skippedEmpty.map(function (s) { return { name: s.name, reason: s.reason }; }),
    skippedExisting.map(function (s) {
      return { name: s.name, reason: s.reason, existingValue: s.existingValue };
    }),
    skippedSelect.map(function (s) { return { name: s.name, reason: s.reason }; })
  );

  var noCrmValue = [];
  var manualReview = [];
  var reviewedGroups = new Set();
  var knownKeys = Object.keys(SYNONYM_MAP);
  for (var mi = 0; mi < fields.length; mi++) {
    var manualField = fields[mi];
    var manualType = (manualField.type || "").toLowerCase();
    var groupId = manualType === "radio" && manualField.name
      ? "radio:" + manualField.name
      : manualField.element;
    if (reviewedGroups.has(groupId)) continue;
    reviewedGroups.add(groupId);
    var liveValue = manualType === "radio"
      ? fields.some(function (candidate) {
          return candidate.type === "radio" && candidate.name === manualField.name && candidate.element.checked;
        })
      : String(manualField.element.value || "").trim();
    if (liveValue) continue;

    var manualItem = {
      fieldName: manualField.name || manualField.id || "",
      fieldLabel: manualField.label || "Unlabelled field",
      type: manualType || manualField.tagName,
      required: !!manualField.required,
    };
    manualReview.push(manualItem);

    var topKey = "";
    var topScore = 0;
    for (var mk = 0; mk < knownKeys.length; mk++) {
      var manualScore = manualField.overrideCrmKey
        ? (manualField.overrideCrmKey === knownKeys[mk] ? 1000 : 0)
        : matchScore(
        knownKeys[mk],
        manualField._identifier,
        manualField.autocomplete,
        manualField._terminalToken,
        manualField._sectionKind
        );
      if (manualScore > topScore) {
        topScore = manualScore;
        topKey = knownKeys[mk];
      }
    }
    if (topScore >= 50 && !String(fieldMap[topKey] || "").trim()) {
      noCrmValue.push(Object.assign({ name: topKey }, manualItem));
    }
  }

  fillSplitDates(fieldMap, filled);

  return {
    mapping: ACTIVE_PORTAL.name,
    filled: filled,
    skipped: skippedAll,
    skippedEmpty: skippedEmpty,
    skippedExisting: skippedExisting,
    skippedSelect: skippedSelect,
    unmatched: unmatched,
    noCrmValue: noCrmValue,
    manualReview: manualReview,
  };
}

// ─── Generic matching (no saved portal mapping) ─────────────────────────

var GENERIC_ALIAS_KEYS = Object.create(null);
Object.keys(GENERIC_FIELDS).forEach(function (key) {
  GENERIC_FIELDS[key].aliases.forEach(function (alias) { GENERIC_ALIAS_KEYS[alias] = key; });
});

/** Lowercase words, splitting camelCase and dropping punctuation: "dateOfBirth" is "date of birth". */
function genericWords(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Your middle name(s) *" is "middle name". */
function genericLabelWords(label) {
  return genericWords(String(label || "").replace(/\([^)]*\)/g, " ").replace(/^\s*your\s+/i, ""));
}

/** Last path segment of a name or id: "applicant[contact][email]" is "email". */
function genericNameWords(name) {
  var parts = String(name || "").split(/[.[\]]+/).filter(function (part) { return part && !/^\d+$/.test(part); });
  return genericWords(parts[parts.length - 1]);
}

/**
 * CRM key an autocomplete attribute names: a key, "" when it gives no purpose, or null when it
 * declares a purpose that is not one whole applicant value (or a billing/shipping/work contact).
 */
function genericAutocompleteKey(value) {
  var tokens = String(value || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens[0] && tokens[0].indexOf("section-") === 0) tokens.shift();
  if (tokens[0] === "shipping" || tokens[0] === "billing") return null;
  if (tokens[0] === "work" || tokens[0] === "fax" || tokens[0] === "pager") return null;
  if (tokens[0] === "home" || tokens[0] === "mobile") tokens.shift();
  if (!AUTOCOMPLETE_PURPOSES.has(tokens[0])) return "";
  return AUTOCOMPLETE_KEY_MAP[tokens[0]] || null;
}

/** "select", "date", "text", or "" for radios, custom comboboxes, and other manual controls. */
function genericControlKind(el) {
  var tag = el.tagName.toLowerCase();
  if (tag === "select") return el.multiple ? "" : "select";
  if (tag === "textarea") return "text";
  if (tag !== "input") return "";
  if ((el.getAttribute("role") || "").toLowerCase() === "combobox" ||
    /^(list|both|inline)$/i.test(el.getAttribute("aria-autocomplete") || "") ||
    /^(true|listbox|menu|dialog|grid|tree)$/i.test(el.getAttribute("aria-haspopup") || "")) return "";
  var type = (el.getAttribute("type") || "text").toLowerCase();
  if (type === "date") return "date";
  return ["text", "email", "tel"].indexOf(type) >= 0 ? "text" : "";
}

function genericHeadingRank(node) {
  if (!node || !node.tagName) return 0;
  if (/^H[1-6]$/.test(node.tagName)) return Number(node.tagName.charAt(1));
  if (node.getAttribute && node.getAttribute("role") === "heading") {
    var level = Number(node.getAttribute("aria-level") || 2);
    return level >= 1 && level <= 6 ? level : 2;
  }
  return 0;
}

/** All enclosing fieldset legends for this control (outer and nested). */
function genericLegendContext(el) {
  var parts = [];
  for (var node = el.parentElement; node; node = node.parentElement) {
    if (node.tagName !== "FIELDSET") continue;
    var legend = null;
    for (var child = node.firstElementChild; child; child = child.nextElementSibling) {
      if (child.tagName === "LEGEND") { legend = child; break; }
    }
    if (legend && legend.textContent) parts.push(legend.textContent);
  }
  return parts.join(" ");
}

/**
 * Nearest form or fieldset ancestor of a heading. Prefer the closer container so an Applicant
 * heading inside fieldset A does not re-scope sibling fieldset B via the shared enclosing form.
 * Headings with no such host still enclose later forms/iframes in document order.
 */
function genericHeadingHost(heading) {
  for (var node = heading && heading.parentElement; node; node = node.parentElement) {
    if (node.tagName === "FIELDSET" || node.tagName === "FORM") return node;
  }
  return null;
}

/** Headings scoped to a form/fieldset apply only to descendants of that nearest host. */
function genericHeadingAppliesTo(heading, el) {
  if (!heading || !el) return false;
  var host = genericHeadingHost(heading);
  if (host && !host.contains(el)) return false;
  return true;
}

/**
 * Outline headings that enclose this control in its owner document: walk body in tree order, keep
 * a heading stack by rank, and stop at the control. Headings outside a form still apply. Earlier
 * sibling sections do not leak in once a same-or-higher heading closes them.
 */
function genericHeadingContext(el) {
  var doc = (el && el.ownerDocument) || document;
  var root = doc && doc.body;
  if (!root || !el || (el.ownerDocument && el.ownerDocument !== doc)) return "";
  var stack = [];
  var nodes = root.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading']");
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node === el || (el.contains && el.contains(node))) continue;
    if (!genericHeadingAppliesTo(node, el)) continue;
    var position = node.compareDocumentPosition(el);
    // PRECEDING means el comes before node, so this heading is after the control.
    if (position & Node.DOCUMENT_POSITION_PRECEDING) break;
    var rank = genericHeadingRank(node);
    if (!rank) continue;
    while (stack.length && stack[stack.length - 1].rank >= rank) stack.pop();
    stack.push({ rank: rank, text: node.textContent || "" });
  }
  return stack.map(function (item) { return item.text; }).join(" ");
}

/** Form's own accessible name/metadata only (not inner section copy). */
function genericFormOwnMetadata(form) {
  if (!form) return "";
  var doc = form.ownerDocument || document;
  var bits = [
    form.getAttribute("aria-label"),
    form.getAttribute("title"),
    form.getAttribute("name"),
    form.id,
  ];
  var labelledby = form.getAttribute("aria-labelledby");
  if (labelledby) {
    var ids = labelledby.split(/\s+/);
    for (var i = 0; i < ids.length; i++) {
      var ref = doc.getElementById(ids[i]);
      if (ref && ref.textContent) bits.push(ref.textContent);
    }
  }
  if (form.id) {
    try {
      var labelEl = doc.querySelector("label[for=\"" + CSS.escape(form.id) + "\"]");
      if (labelEl && labelEl.textContent) bits.push(labelEl.textContent);
    } catch (error) { /* invalid id */ }
  }
  return genericWords(bits.join(" "));
}

/** Same-origin embedding chain: iframe title/name/aria-label plus parent enclosing sections. */
function genericEmbeddingContext() {
  var parts = [];
  try {
    var frame = window.frameElement;
    while (frame) {
      parts.push(frame.getAttribute("title") || "");
      parts.push(frame.getAttribute("name") || "");
      parts.push(frame.getAttribute("aria-label") || "");
      parts.push(genericLegendContext(frame));
      parts.push(genericHeadingContext(frame));
      var hostForm = frame.closest && frame.closest("form");
      if (hostForm) parts.push(genericFormOwnMetadata(hostForm));
      var parentView = frame.ownerDocument && frame.ownerDocument.defaultView;
      frame = parentView && parentView.frameElement;
    }
  } catch (error) { /* cross-origin parent */ }
  return parts.join(" ");
}

function genericSectionText(el) {
  return [genericLegendContext(el), genericHeadingContext(el), genericEmbeddingContext()].join(" ");
}

/** Form-level auth/recovery wording from aria-label, action, instructions and submit labels. */
function genericFormContext(form) {
  if (!form) return "";
  var bits = [
    form.getAttribute("aria-label"),
    form.getAttribute("name"),
    form.id,
    form.getAttribute("action"),
  ];
  var notes = form.querySelectorAll("p, [role='status'], .instructions, .help, .hint");
  for (var i = 0; i < notes.length && i < 6; i++) bits.push(notes[i].textContent);
  var actions = form.querySelectorAll("button, input[type='submit'], input[type='button']");
  for (var j = 0; j < actions.length && j < 8; j++) {
    bits.push(actions[j].textContent || actions[j].value || actions[j].getAttribute("aria-label"));
  }
  return genericWords(bits.join(" "));
}

function liveFieldMeta(el) {
  return {
    element: el,
    name: el.name || "",
    id: el.id || "",
    label: getLabelForElement(el, true),
    autocomplete: el.getAttribute("autocomplete") || "",
    type: ((el.getAttribute("type") || el.tagName || "") + "").toLowerCase(),
    tagName: (el.tagName || "").toLowerCase(),
    required: !!el.required,
  };
}

/**
 * The applicant CRM key a control asks for, or "" to leave it manual. The control's label,
 * name, id and autocomplete must agree on one supported key; a label naming anything else wins.
 */
function genericFieldKey(field) {
  var el = field.element;
  if (!el || el.isConnected === false) return "";
  var kind = genericControlKind(el);
  if (!kind) return "";
  var form = el.form || (el.closest && el.closest("form"));
  if (form && form.querySelector("input[type='password']")) return "";
  if (form && GENERIC_BLOCKED.form && GENERIC_BLOCKED.form.test(genericFormContext(form))) return "";
  if (form && GENERIC_BLOCKED.section.test(genericFormOwnMetadata(form))) return "";
  var autocomplete = genericAutocompleteKey(field.autocomplete || el.getAttribute("autocomplete") || "");
  if (autocomplete === null) return "";
  var label = field.label != null ? field.label : getLabelForElement(el, true);
  var own = genericWords([label, el.name, el.id, el.getAttribute("placeholder"), getAriaDescribedbyText(el), field.autocomplete || el.getAttribute("autocomplete")].join(" "));
  if (GENERIC_BLOCKED.field.test(own) || GENERIC_BLOCKED.section.test(genericWords(genericSectionText(el)))) return "";
  var labelKey = label ? GENERIC_ALIAS_KEYS[genericLabelWords(label)] : "";
  if (labelKey === undefined) return "";
  var keys = [labelKey, GENERIC_ALIAS_KEYS[genericNameWords(el.name)], GENERIC_ALIAS_KEYS[genericNameWords(el.id)], autocomplete]
    .filter(Boolean);
  if (!keys.length || keys.some(function (key) { return key !== keys[0]; })) return "";
  return GENERIC_FIELDS[keys[0]].controls.indexOf(kind) >= 0 ? keys[0] : "";
}

/** How many live fillable controls currently classify as this CRM key. */
function countLiveGenericKey(key) {
  if (!key) return 0;
  var live = scanFormFields({ mode: "fill" });
  var count = 0;
  for (var i = 0; i < live.length; i++) {
    if (genericFieldKey(liveFieldMeta(live[i].element)) === key) count++;
  }
  return count;
}

function genericSelectNorm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function genericSelectAliasSet(crmKey, wanted) {
  var aliases = Object.create(null);
  aliases[wanted] = true;
  var groups = GENERIC_SELECT_EQUIV[crmKey] || [];
  for (var g = 0; g < groups.length; g++) {
    var normalized = groups[g].map(genericSelectNorm);
    if (normalized.indexOf(wanted) === -1) continue;
    for (var i = 0; i < normalized.length; i++) aliases[normalized[i]] = true;
  }
  return aliases;
}

/** True when the token belongs to any equivalence group for this CRM key. */
function genericSelectTokenInAnyGroup(crmKey, token) {
  if (!token) return false;
  var groups = GENERIC_SELECT_EQUIV[crmKey] || [];
  for (var g = 0; g < groups.length; g++) {
    var normalized = groups[g].map(genericSelectNorm);
    if (normalized.indexOf(token) !== -1) return true;
  }
  return false;
}

function genericOptionDisabled(option) {
  if (!option || option.disabled) return true;
  var group = option.parentElement;
  return !!(group && group.tagName === "OPTGROUP" && group.disabled);
}

/** Numeric or UUID submitted values are opaque encodings, not competing human labels. */
function genericSelectValueOpaque(token) {
  if (!token) return false;
  if (/^[0-9]+$/.test(token)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

/**
 * Exact or explicit-equivalence select match; disabled or non-unique values stay manual.
 * Match HTMLOptionElement.label (label attribute or browser text fallback), never option.text
 * alone. Require a nonempty recognized displayed label. A different submitted value must share
 * that meaning or be an opaque numeric/UUID code. Blank, whitespace-only, and unsupported
 * (e.g. non-Latin) displayed labels stay manual even when the value token matches.
 */
function matchGenericSelectOption(el, value, crmKey, isPlaceholderOption) {
  var wanted = genericSelectNorm(value);
  if (!wanted) return null;
  var aliases = genericSelectAliasSet(crmKey, wanted);
  var submittedCounts = Object.create(null);
  var i;
  for (i = 0; i < el.options.length; i++) {
    var counted = el.options[i];
    if (isPlaceholderOption(counted)) continue;
    var raw = String(counted.value);
    submittedCounts[raw] = (submittedCounts[raw] || 0) + 1;
  }
  var matches = [];
  for (i = 0; i < el.options.length; i++) {
    var option = el.options[i];
    if (isPlaceholderOption(option) || genericOptionDisabled(option)) continue;
    if (submittedCounts[String(option.value)] !== 1) continue;
    var displayLabel = genericSelectNorm(option.label);
    var optionValue = genericSelectNorm(option.value);
    var textHit = !!aliases[displayLabel];
    var valueHit = !!aliases[optionValue];
    if (!displayLabel || !textHit) continue;
    if (optionValue && displayLabel !== optionValue) {
      if (!valueHit && !genericSelectValueOpaque(optionValue)) continue;
      if (!valueHit && genericSelectTokenInAnyGroup(crmKey, optionValue)) continue;
    }
    matches.push(option);
  }
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Select one concrete enabled option by identity. Verifies the selected option after write;
 * does not use the value-only legacy path that can land on a duplicate-value sibling.
 */
function applyGenericSelectOption(el, opt) {
  if (!el || !opt || el.tagName !== "SELECT" || genericOptionDisabled(opt)) return false;
  if (opt.parentNode !== el && !(opt.parentElement && opt.parentElement.parentNode === el)) return false;
  var unique = 0;
  for (var i = 0; i < el.options.length; i++) {
    if (String(el.options[i].value) === String(opt.value)) unique++;
  }
  if (unique !== 1) return false;
  try {
    for (var j = 0; j < el.options.length; j++) el.options[j].selected = false;
    opt.selected = true;
    el.selectedIndex = opt.index;
    var desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (desc && desc.set) desc.set.call(el, opt.value);
    else el.value = opt.value;
    if (el.options[el.selectedIndex] !== opt || genericOptionDisabled(el.options[el.selectedIndex])) {
      return false;
    }
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    if (el.options[el.selectedIndex] !== opt) return false;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fill a page without a saved mapping. Each supported key goes into the one control that asks for
 * it; when several controls ask for the same key, all of them stay manual. Classification,
 * fillability and uniqueness are recomputed from live metadata immediately before each write.
 */
async function autofillGeneric(fieldMap, fields) {
  var report = { mapping: null, filled: [], skippedExisting: [], noCrmValue: [], manualReview: [], unmatched: [] };
  var matched = new Set();
  var reviewedGroups = new Set();
  var writtenKeys = new Set();
  for (var i = 0; i < fields.length; i++) {
    var el = fields[i].element;
    if (!el || el.isConnected === false) continue;
    var field = liveFieldMeta(el);
    var item = {
      fieldName: field.name || field.id || "",
      fieldLabel: field.label || "Unlabelled field",
      type: (field.type || field.tagName || "").toLowerCase(),
      required: !!field.required,
    };
    if (item.type === "radio") {
      var group = field.name ? "radio:" + field.name : el;
      if (reviewedGroups.has(group)) continue;
      reviewedGroups.add(group);
      var checked = field.name
        ? fields.some(function (other) { return other.type === "radio" && other.name === field.name && other.element.checked; })
        : el.checked;
      if (!checked) report.manualReview.push(item);
      continue;
    }
    var existing = String(el.value || "").trim();
    var key = genericFieldKey(field);
    if (key && (writtenKeys.has(key) || countLiveGenericKey(key) !== 1)) key = "";
    var value = key ? String(fieldMap[key] || "").trim() : "";
    if (key) matched.add(key);
    if (existing) {
      if (value) report.skippedExisting.push(Object.assign({ name: key, existingValue: truncate(existing, 30), reason: "Field already has a value" }, item));
      continue;
    }
    field = liveFieldMeta(el);
    key = genericFieldKey(field);
    if (key && (writtenKeys.has(key) || countLiveGenericKey(key) !== 1)) key = "";
    value = key ? String(fieldMap[key] || "").trim() : "";
    item.fieldLabel = field.label || item.fieldLabel;
    item.type = (field.type || field.tagName || item.type).toLowerCase();
    if (value && isFillable(el) && await setElementValue(el, value, { label: field.label, name: field.name, id: field.id, crmKey: key })) {
      writtenKeys.add(key);
      matched.add(key);
      report.filled.push(Object.assign({ name: key, value: truncate(value, 30), matchReason: "Shared field match" }, item));
      continue;
    }
    if (key && !value) report.noCrmValue.push(Object.assign({ name: key }, item));
    report.manualReview.push(item);
  }
  report.unmatched = Object.keys(fieldMap).filter(function (crmKey) {
    return String(fieldMap[crmKey] || "").trim() && !matched.has(crmKey);
  });
  return report;
}

/**
 * Optional enrichment for full scans (not used on lean auto-scan path).
 * @param {Array} fields
 * @param {Record<string,string>} fieldMap
 * @returns {Array}
 */
function enrichFieldsWithMapping(fields, fieldMap) {
  warmSynonymCaches();
  precomputeFieldMatchMeta(fields);
  var crmKeys = Object.keys(fieldMap);
  return fields.map(function (field) {
    var enriched = Object.assign({}, field);
    delete enriched.element;

    var identifier = field._identifier || getFieldIdentifier(field);
    var terminalToken = field._terminalToken != null
      ? field._terminalToken
      : getTerminalToken(field.name);
    var sectionKind = field._sectionKind != null
      ? field._sectionKind
      : getSectionKind(field);
    var bestScore = 0;
    var bestKey = null;

    for (var k = 0; k < crmKeys.length; k++) {
      var score = field.overrideCrmKey
        ? (field.overrideCrmKey === crmKeys[k] ? 1000 : 0)
        : matchScore(
        crmKeys[k],
        identifier,
        field.autocomplete,
        terminalToken,
        sectionKind
        );
      if (score > bestScore) {
        bestScore = score;
        bestKey = crmKeys[k];
      }
    }

    enriched.suggestedCrmKey = bestKey;
    enriched.confidence = bestScore;
    enriched.matchReason = bestKey && bestScore >= 50
      ? "Score " + bestScore + " (best match)"
      : (bestKey ? "Score " + bestScore + " (below threshold)" : "No match");

    return enriched;
  });
}

globalThis.SAMS_ENGINE = {
  scanFormFields,
  autofillPage,
  enrichFieldsWithMapping,
  formatValueForField,
  safeClick,
  isFillable,
};

} // end loaded guard
