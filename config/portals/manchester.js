{
globalThis.SAMS_PORTALS = globalThis.SAMS_PORTALS || [];
const config = {
  id: "greater-manchester",
  name: "University of Greater Manchester",
  origins: [],
  pageMatchers: [],
  selectorOverrides: {},
  extraSynonyms: {},
  blockedControls: [],
};
const index = globalThis.SAMS_PORTALS.findIndex((portal) => portal.id === config.id);
if (index === -1) globalThis.SAMS_PORTALS.push(config);
else globalThis.SAMS_PORTALS[index] = config;
}
