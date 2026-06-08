# Planner

Plan:
1. Inspect shared color runtime and CSS custom-color selectors.
2. Confirm clear reset path exists and expose it in the shared menu.
3. Preserve clear as a first-class persisted state distinct from default theme color.
4. Scope widget body tint to user-selected widget colors so default seeded colors preserve object material parity.
5. Reproduce panel-contained move through the drawer handle.
6. Restore widget drawer before absorption cloning so panel children keep customization controls.
7. Run focused canaries and full e2e.

Risk:
Default theme color and explicit no-color both previously serialized as a missing color, causing cleared seeded panels to rehydrate their defaults.
