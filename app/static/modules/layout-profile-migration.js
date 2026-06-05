export const migrateWorkingLayoutProfiles = ({ layoutPersistence }) => {
  const WORKING = layoutPersistence.WORKING_PROFILE;
  document.querySelectorAll("[data-layout-key]").forEach((el) => {
    const layoutKey = el.dataset.layoutKey;
    if (!layoutKey) return;
    const current = layoutPersistence.getActiveProfile(layoutKey);
    if (current !== WORKING && /^[1-9][0-9]*$/.test(current)) {
      layoutPersistence.copyProfile(layoutKey, current, WORKING);
      layoutPersistence.setActiveProfile(layoutKey, WORKING);
    }
  });
};
