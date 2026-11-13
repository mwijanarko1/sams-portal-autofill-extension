{
// Postcode shapes used worldwide. One table feeds both the CRM reader and the portal engine, so an
// address from any country splits the same way on both sides. Each pattern is an alternation branch
// without anchors. Order matters: a more specific shape must come before a plainer one it could shadow.
const SAMS_POSTCODE_FORMATS = [
  // United Kingdom: SW1A 2AA, M1 1AE, EC1A 1BB
  "[A-Z]{1,2}\\d[A-Z\\d]?\\s*\\d[A-Z]{2}",
  // Ireland Eircode: D02 X285, A65F4E2
  "[A-Z]\\d{2}\\s?[A-Z\\d]{4}",
  // Canada: K1A 0B1
  "[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d",
  // Netherlands: 1234 AB
  "\\d{4}\\s?[A-Z]{2}",
  // Argentina: C1425ABC
  "[A-Z]\\d{4}[A-Z]{3}",
  // Malta: VLT 1117
  "[A-Z]{3}\\s?\\d{4}",
  // Country-coded: LT-12345, LV-1050, L-1234, AZ1000, BS8811, MD-2001
  "[A-Z]{2,3}-?\\d{4,5}(?:-\\d{3,4})?",
  "[A-Z]-\\d{4}",
  // Ghana digital address: GA-123-4567
  "[A-Z]{2}-\\d{3}-\\d{3,4}",
  // Digits with a dash: US 12345-6789, Brazil 01310-100, Japan 100-0001, Portugal 1000-001, Iran 12345-67890
  "\\d{3,5}-\\d{3,5}",
  // Poland: 00-950
  "\\d{2}-\\d{3}",
  // Digits with a space: Sweden, Czechia, Slovakia, Greece 114 71
  "\\d{3}\\s\\d{2}",
  // Plain digits: 4 to 7 (Belgium and Australia 4, USA and Germany 5, India and Singapore 6, Chile and Israel 7)
  "\\d{4,7}",
];

const SAMS_POSTCODE_SOURCE = SAMS_POSTCODE_FORMATS.join("|");

globalThis.SAMS_POSTCODES = {
  source: SAMS_POSTCODE_SOURCE,
  // A postcode at the end of a text, after a space or at the start: group 1.
  end: new RegExp("(?:^|\\s)(" + SAMS_POSTCODE_SOURCE + ")$", "i"),
  // A postcode at the start, optionally followed by a city: group 1 and group 2.
  start: new RegExp("^(" + SAMS_POSTCODE_SOURCE + ")(?:\\s+(.+))?$", "i"),
  // A whole text that is one postcode.
  whole: new RegExp("^(?:" + SAMS_POSTCODE_SOURCE + ")$", "i"),
  // A postcode of digits, spaces and dashes only. Such a value can also be a house number or a range.
  isWeak: function (value) { return /^[\d\s-]+$/.test(String(value || "")); },
};
}
