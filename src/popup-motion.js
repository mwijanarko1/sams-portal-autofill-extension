// Motion only. popup.js toggles hidden/open attributes with no animation, so this slides the elements
// that move as a result (FLIP) and never touches state. Newly shown elements fade in from CSS.
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tracked = ["#btnCopy", ".action-row", "#btnDocuments", "#btnStopFillAll", "#fillAllStatus", "#copiedDetails", "#copiedDocuments", "#statusArea"]
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);

  // offsetTop ignores transforms, so a measurement taken mid-slide is still the settled position.
  const measure = () => {
    const tops = new Map();
    for (const element of tracked) {
      if (element.getClientRects().length) tops.set(element, element.offsetTop);
    }
    return tops;
  };

  let before = measure();
  new MutationObserver(() => {
    const after = measure();
    if (!reduced.matches) {
      for (const [element, top] of after) {
        const previous = before.get(element);
        if (previous === undefined || Math.abs(previous - top) < 2) continue;
        element.animate(
          [{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }],
          { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
    }
    before = after;
  }).observe(document.body, { attributes: true, attributeFilter: ["hidden", "open"], childList: true, subtree: true });
})();
