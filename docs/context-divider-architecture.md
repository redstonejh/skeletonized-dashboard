# Context Divider Architecture

## Purpose

Context Dividers are a future spatial organization layer for the dashboard workspace.

They mark horizontal boundaries in the large dashboard grid and define ambient context zones within one continuous workspace. They are not tabs, pages, panels, or content widgets. They are spatial context boundaries: visible, interactive markers that help the dashboard understand which objects belong to which region.

This is a planning document only. Do not implement runtime behavior, placeholder UI, persistence changes, or new interaction handlers without a follow-up implementation task.

## Concept Name

Recommended system name: **Spatial Context Zones**.

Recommended object name: **Context Divider**.

Rationale:

- "Context Divider" is concrete and easy to understand as the visible horizontal boundary.
- "Spatial Context Zone" describes the region created by one or more dividers.
- The pair keeps the distinction clear: the divider is the marker, the zone is the inherited context area.

Acceptable secondary terms:

- Context Boundary, when discussing geometry.
- Region Divider, when discussing visual layout.
- Zone Header, only if a future collapsed/expanded region header behavior is introduced.

Avoid:

- Tab, page, route, section tab, panel, context panel, table row, or folder.
- Any label that implies the divider contains content like a panel.

## Concept Definition

A Context Divider is four things at once:

- A layout object that occupies a narrow row footprint in the dashboard grid.
- A metadata marker that owns zone-level context defaults and identity.
- A visual boundary that separates one spatial region from the next.
- An interaction surface for selecting, moving, labeling, and managing the region.

It is not a normal panel.

It should not:

- Contain widgets.
- Expand like a content panel by default.
- Use panel body placeholders.
- Participate in panel settings/content architecture.
- Behave like a manual group selection.

It may:

- Reserve vertical space.
- Span the full dashboard width by default.
- Be draggable vertically.
- Be labelable and accentable.
- Define context metadata inherited by items in its zone.
- Become a navigation target for Spatial Anchors.

## Relationship To Existing Models

### Dashboard

The dashboard remains the global workspace. It owns the full grid, global layout, theme, profile state, and global context.

### Context Divider Zone

A Spatial Context Zone is an ambient region of the dashboard. Items inside the zone inherit region context unless they have local overrides or stronger explicit links.

### Grouped Objects

Grouped objects remain explicit local multi-selection. A group is an active user selection or future persisted membership. A zone is ambient and spatial.

Comparison:

- Group selection: "These selected objects move or resize together right now."
- Context Divider Zone: "Objects in this spatial region inherit this context."
- Dashboard: "Everything exists in one continuous workspace."

### Spatial Anchors

Spatial Anchors can target a divider or zone. Clicking the anchor should scroll to the divider/zone inside the same dashboard, not switch tabs.

## UX Model

### Creation

Users should create a Context Divider through explicit intent:

- Add context divider from a create menu.
- Create divider above selected object or group.
- Create divider at current viewport position.
- Create divider from a future context command.

Creation should place the divider at a valid grid row and use local pushdown if it collides with existing items. It should not globally repack the dashboard.

### Appearance

A divider should feel like a refined glass boundary, not a crude `<hr>` line.

Recommended visual structure:

- A subtle full-width horizontal glass rail.
- A compact label pill seated on or slightly above the rail.
- Optional icon inside the pill.
- Optional accent thread or glow tied to zone context.
- Soft inner highlight and low-contrast border.
- Calm hover/focus/selected states.

The divider should be visible enough to orient the user but quiet enough that dashboard objects remain primary.

### Labeling

Dividers may have:

- Label.
- Icon.
- Accent color.
- Short description or metadata visible in an inspector.
- Context summary badges in the future.

Labels should be concise. Long labels should truncate gracefully and expose the full label in tooltip/accessibility text.

### Movement

Dragging a divider vertically moves the boundary and therefore changes zone membership for objects above/below it.

Rules:

- Movement should snap to valid grid rows.
- Existing items should not be scrambled.
- If the divider is inserted into occupied space, local pushdown or constrained placement should apply.
- Moving a divider should not resize or move contained objects unless a future explicit "move zone contents" mode exists.
- The divider must never become a content panel.

### Selection

Selecting a divider may show region controls:

- Rename.
- Change icon/accent.
- Create Spatial Anchor.
- Inspect inherited context.
- Delete divider.
- Future collapse/expand region controls.

Controls should use the same glass tool language as panels/widgets, but the commands should be divider/zone commands, not panel content commands.

### Navigation

Dividers are natural scroll targets.

Clicking a Spatial Anchor that targets a divider should:

1. Resolve the divider by id.
2. Scroll to the divider or the zone it defines.
3. Respect navbar/header offset.
4. Use smooth motion unless reduced motion is requested.
5. Preserve the feeling of one continuous dashboard.

## Bounds Model

### Default Vertical Bounds

The recommended first implementation is row-to-row vertical bounds:

- A divider starts a zone at its grid row.
- The zone extends until the next divider's grid row.
- If there is no next divider, the zone extends to the end of dashboard content.
- Objects whose primary grid row begins inside the interval inherit the zone context.

This is simple, deterministic, and compatible with the current grid.

### Full-Width Default

Dividers should default to full dashboard width.

Reasons:

- The initial mental model is a horizontal workspace region.
- Full-width zones are easier to understand and test.
- Context inheritance is deterministic without column clipping rules.

### Future Column-Scoped Dividers

Column-scoped dividers may be useful later, but they should not be part of the first implementation.

If introduced, a divider may define:

- `gridColumn`
- `gridColumnSpan`
- `fullWidth: false`

Column-scoped zones require more careful overlap rules, especially for objects spanning columns. They should wait until full-width zones are stable.

### Explicit End Markers

Explicit end markers are not recommended for the first model.

They add complexity:

- Two boundaries per zone.
- More deletion/reordering edge cases.
- Ambiguous behavior when markers overlap.

The next-divider rule is easier to reason about and aligns with document-like sectioning while staying spatial.

### Object Membership

Recommended first rule:

- An item belongs to the zone containing its top grid row.

Future refinements:

- If an item spans multiple zones, show a cross-zone state.
- Let local override choose a primary zone.
- For tall objects, use the header/top edge as the inherited-context anchor.

Do not infer membership from visual overlap during live drag until the snapped footprint is known.

## Context Inheritance Model

Context Dividers introduce a region-level `ContextScope`.

Recommended precedence:

1. Direct widget selection or local widget context.
2. Explicit context links.
3. Local panel context.
4. Group context, if a future persistent semantic group exists.
5. Spatial Context Zone inherited from divider.
6. Dashboard/global context.

Rules:

- Widgets inherit the nearest containing zone context unless locally overridden.
- Panels inherit zone context as containers, then pass it to future children according to panel inheritance rules.
- Groups inherit shared zone context when all movable members are in the same zone.
- If a group spans multiple zones, it enters mixed-zone context state.
- Local overrides must be visually legible.
- Moving an object across a divider boundary should update inherited context after commit.
- Live drag may preview the prospective zone, but committed context changes only on drop.
- Resize may change zone membership only if the item's membership rule depends on its top row or future explicit anchor point.

Context inheritance must be data-owned and deterministic. It must not be inferred from CSS hover state or transient DOM classes.

## Layout Integration

### Grid Participation

A divider should participate in the dashboard grid as a protected layout object type:

```text
type: context-divider
occupancy: divider row footprint
resizable: limited or false initially
draggable: vertical only initially
containsContent: false
```

The divider reserves enough vertical space for its rail, label, focus ring, and controls.

### Collision Rules

Dividers should be collision-aware.

Rules:

- Normal items should not overlap the divider's reserved row.
- Adding a divider into occupied space should locally push affected items downward.
- Moving a divider should avoid pinned items and maintain deterministic placement.
- Divider movement should not cause global compaction.
- Divider collision should use the same occupancy model as widgets/panels where possible.

### Drag And Resize Near Dividers

Widgets and panels should snap around dividers as reserved grid occupants.

During drag:

- The snapped footprint determines prospective zone membership.
- If an item crosses a divider boundary, show a subtle inherited-context preview.
- Do not commit context until drop.

During resize:

- The item remains in the zone containing its membership anchor, initially top row.
- A tall item crossing a divider should show cross-zone ambiguity only if that future behavior is implemented intentionally.

### Divider Drag

Divider drag should be a constrained vertical interaction.

Expected lifecycle:

1. User grabs divider handle or rail.
2. A live divider surface follows the pointer vertically.
3. A snapped row footprint shows the committed destination.
4. Affected items preview local pushdown if needed.
5. On release, divider row commits.
6. Zone memberships recompute deterministically.

The live visual and snapped footprint model should match existing drag/resize doctrine.

### Horizontal Resize

Do not support horizontal resizing in the first implementation unless there is a clear column-scoped zone requirement.

Full-width dividers are the stable default.

## Data Model Proposal

Divider records should be stored separately enough to preserve type semantics, while still participating in layout occupancy.

Example:

```json
{
  "id": "divider_focus_area",
  "type": "context-divider",
  "label": "Planning",
  "icon": "layout-template",
  "accent": "slate",
  "layout": {
    "gridRow": 8,
    "gridColumn": 1,
    "gridColumnSpan": 6,
    "fullWidth": true,
    "rowSpan": 1,
    "order": 3
  },
  "context": {
    "scopeId": "scope_planning",
    "values": [
      {
        "key": "timeframe",
        "value": "this_week",
        "label": "This week"
      }
    ],
    "inheritance": "zone",
    "overridePolicy": "local-overrides-zone"
  },
  "navigation": {
    "anchorTarget": true,
    "scrollAlignment": "start-with-header-offset"
  },
  "collapsed": false,
  "metadata": {
    "description": "",
    "createdFrom": "command",
    "createdAt": "2026-05-24T00:00:00Z",
    "updatedAt": "2026-05-24T00:00:00Z"
  }
}
```

Recommended fields:

- `id`: stable divider id.
- `type`: always `context-divider`.
- `label`: short visible label.
- `icon`: generic icon key.
- `accent`: theme-aware color/accent token.
- `layout.gridRow`: divider row.
- `layout.gridColumn`: usually `1`.
- `layout.gridColumnSpan`: usually dashboard column count.
- `layout.fullWidth`: first implementation should default to `true`.
- `layout.rowSpan`: initially `1`.
- `layout.order`: deterministic ordering among dashboard objects.
- `context.scopeId`: region scope id.
- `context.values`: optional default inherited context values.
- `context.inheritance`: zone inheritance mode.
- `context.overridePolicy`: conflict behavior.
- `navigation.anchorTarget`: whether anchors can target it.
- `navigation.scrollAlignment`: preferred scroll behavior.
- `collapsed`: future region collapse state, not first implementation.
- `metadata`: created/updated/source data.

### Persistence Boundaries

Context Dividers touch three future payloads:

- Layout occupancy: grid row/span/order.
- Context scope: inherited context values and policy.
- Navigation target: anchor resolution metadata.

These should be clearly separated in code even if saved in one profile payload.

Do not save transient drag preview state, hover state, selected state, or prospective context during live movement.

## Interaction Lifecycle

### Create Divider

1. User invokes create divider.
2. App chooses intended grid row from current viewport or selection.
3. App creates divider layout footprint.
4. Local collision/pushdown resolves only affected items.
5. Divider commits with a stable id and context scope.
6. Zone membership recomputes.
7. Optional label edit begins if the create flow supports it.

### Move Divider

1. User starts drag on divider.
2. Existing layout snapshot is captured.
3. Live divider surface follows pointer.
4. Snapped divider footprint previews target row.
5. Local reflow preview shows affected items.
6. On commit, divider row updates.
7. Zone membership recomputes from committed layout.
8. Persistence writes committed state only.

### Delete Divider

1. User selects delete.
2. App confirms if the divider has context metadata or anchors.
3. Divider is removed.
4. Its zone merges into the previous containing/global zone.
5. Items formerly in the zone recompute inherited context.
6. Spatial Anchors targeting the divider enter missing-target state or offer relink/delete.

Deletion should not move widgets/panels unless a future explicit layout cleanup command is invoked.

### Move Item Across Divider

1. User drags item.
2. Live ghost follows pointer.
3. Snapped footprint enters another zone.
4. Optional context preview appears.
5. On drop, item commits to new grid row.
6. Context engine recomputes inherited zone context.
7. Visual indicators update.

The item's context must not change permanently during preview.

### Group Across Divider

1. User moves selected group.
2. Composite footprint previews target zone(s).
3. If all group members land in one zone, the group previews shared inherited context.
4. If members span multiple zones, show mixed-zone state.
5. On commit, each member resolves context by final row.

Group movement remains a composite spatial transform. Zone inheritance is recomputed after layout commit.

## Visual Language

Context Dividers should extend the existing glass material system.

### Default

- Thin translucent rail.
- Subtle slate border.
- Soft inner highlight.
- Gentle shadow below the rail.
- Label pill with compact icon/text.
- Accent appears as a restrained thread, dot, or tinted edge.

### Hover

- Slightly stronger rail contrast.
- Label pill lifts subtly.
- Controls become discoverable without shifting layout.

### Focus

- Visible keyboard focus ring using shared dashboard focus language.
- No harsh white ring on deep backgrounds.
- Focus should include the label pill and enough of the rail to communicate the target.

### Selected

- Calm selected outline or halo matching group/selection language.
- Region bounds may be hinted lightly, but avoid heavy filled overlays.

### Active Drag

- Live divider surface uses transform-based motion.
- Snapped footprint shows target row.
- No black/debug outlines.
- No table-row styling.

### Missing Or Broken Context

If a divider references context metadata that cannot resolve:

- Use a muted warning state.
- Avoid alarming colors unless the user is managing the issue.
- Offer repair in a future inspector.

### Light Mode

Direction:

- Slate-neutral glass.
- Subtle ridged line.
- Soft label pill.
- Quiet accent.
- No washed-out white strip.

### Dark Mode

Direction:

- Smoked-glass rail.
- Low-contrast slate edge.
- Soft inner highlight.
- No neon accent.
- No pure black debug line.

## Accessibility

Context Dividers must be understandable and operable by keyboard.

Requirements:

- Divider has `role` and accessible name appropriate to future implementation.
- Label is announced.
- Context summary is available through accessible description or inspector.
- Keyboard focus is visible.
- Keyboard movement or management path exists if divider drag is pointer-based.
- Delete/rename/context controls are reachable.
- Reduced motion is respected for scroll-to-divider and divider drag previews.
- Divider should not create hidden tab traps.
- Zone membership changes should not surprise screen reader users without a state update or focus-preserving pattern.

Possible keyboard model:

- Tab focuses divider label/control.
- Enter opens divider controls.
- Space selects divider.
- Arrow movement works only in explicit move mode.
- Escape exits move/control mode.

## Edge Cases

### Item Overlaps Divider

The layout engine should treat the divider row as occupied. Normal placement should avoid overlap. If a legacy/saved layout loads with overlap, resolve deterministically or flag the layout for repair.

### Item Moved Between Dividers

The item inherits the new zone context after drop. During drag, show only a preview state.

### Divider Deleted

Items in the deleted zone merge into the previous zone or global dashboard context. Anchors targeting the divider enter missing-target state.

### Divider Reordered

Zone bounds recompute by divider grid row, not DOM order alone. Equal rows should be invalid or resolved deterministically.

### Multiple Dividers Close Together

The system should enforce a minimum row gap or allow narrow empty zones with a clear visual state. Avoid label overlap.

### Save/Load

Save divider layout, context scope metadata, and anchor target compatibility. Load should not compact dividers or infer zones from DOM order when explicit rows exist.

### Group Spans Two Context Zones

Show mixed-zone inherited context. Do not silently choose one zone for the entire group unless a future group-level override exists.

### Widget Local Override Conflicts With Zone Context

Local override wins according to precedence. The UI should show that the widget differs from its inherited zone.

### Collapsed/Expanded Panel Crosses Divider Boundary

A panel's zone membership should initially be based on its header/top row. Expansion crossing a divider should not change inherited context unless future rules explicitly support cross-zone panels.

### Divider Inside Temporary Expansion Pushdown

Expansion/collapse displacement must not permanently rewrite divider identity or zone context. Divider row changes should be committed only by divider movement or explicit layout changes.

### Pinned Items

Pinned items remain hard reservations. Dividers should not push pinned items. If insertion collides with a pinned item, the divider should find the next valid local row or reject the placement with clear feedback.

### Spatial Anchor Targets Divider

If the divider moves, anchors resolve by divider id. If the divider is deleted, anchors enter missing-target state.

### Mobile Viewport

Divider labels may need compact or stacked display. The rail should remain legible without creating horizontal overflow.

## Risks

- Dividers become visually heavy and make the dashboard feel segmented like pages.
- Users confuse dividers with panels.
- Context inheritance becomes invisible or surprising.
- Moving a divider causes unexpected context changes.
- Zone calculations depend on DOM order rather than committed grid rows.
- Full-width divider assumptions break future column-scoped regions.
- Group movement across zones creates ambiguous inherited context.
- Divider collision logic reintroduces global repacking.
- Anchor navigation to dividers starts to feel like tab switching.
- Too many dividers create clutter.

Mitigations:

- Keep dividers visually calm.
- Keep context indicators legible.
- Commit inherited context only after layout commit.
- Store dividers with explicit ids and grid rows.
- Start with full-width only.
- Keep group selection separate from zone membership.
- Use local collision/pushdown rules.
- Keep Spatial Anchors viewport-fixed and tabless.

## Testing Strategy

Future Playwright coverage should include:

- Divider creation at current viewport row.
- Divider creation above selected item.
- Divider local pushdown without global scramble.
- Divider drag to a new row.
- Divider save/load persistence.
- Zone membership assignment by committed grid row.
- Moving a widget across a divider updates inherited context after drop.
- Moving a panel across a divider updates inherited context after drop.
- Group moved entirely into a zone inherits shared zone context.
- Group spanning two zones shows mixed-zone state.
- Divider deletion merges/recomputes context predictably.
- Spatial Anchor scrolls to divider with navbar offset.
- Drag/resize near divider avoids overlap.
- Expanded/collapsed panels do not corrupt zone membership.
- Pinned items block divider insertion/movement.
- Light mode divider visuals.
- Dark mode divider visuals.
- Keyboard focus and accessible labels.
- Reduced motion for scroll-to-divider.
- No horizontal overflow on desktop or mobile.

Manual verification should cover:

- Divider visual weight in dense dashboards.
- Hover/focus/selected/drag states.
- Context preview during item movement.
- Anchor navigation to dividers.
- Shared material parity across background tones.
- Dashboard feel remains continuous and tabless.

## Staged Implementation Plan

### Stage 1: Vocabulary And Documentation

- Keep this document current.
- Reference Context Dividers from context, spatial workspace, and anchor architecture docs when implementation begins.
- Do not add UI yet.

### Stage 2: Data Shape And Read-Only Rendering

- Define divider records.
- Render seeded dividers read-only.
- Verify default and deep-background visual language.
- Keep dividers separate from panels/widgets semantically.

### Stage 3: Layout Occupancy

- Add divider occupancy to the shared dashboard grid model.
- Reserve divider rows.
- Prevent overlap.
- Save/load divider layout.

### Stage 4: Zone Resolver

- Compute zones from committed divider rows.
- Assign inherited zone context to widgets/panels.
- Expose resolver outputs for tests and future UI indicators.

### Stage 5: Creation Flow

- Add explicit create divider command.
- Place divider deterministically.
- Use local pushdown only.
- Start label edit or inspector as appropriate.

### Stage 6: Divider Movement

- Add constrained vertical drag.
- Use live surface plus snapped footprint.
- Recompute zone membership only on commit.
- Protect pinned items and avoid global repack.

### Stage 7: Context Integration

- Connect divider zones to the context engine.
- Add inherited context indicators.
- Support local override visibility.
- Add mixed-zone group state.

### Stage 8: Spatial Anchor Integration

- Allow anchors to target dividers/zones.
- Smooth-scroll to divider with header offset.
- Handle missing divider targets.

### Stage 9: Management And Edge Cases

- Rename/icon/accent controls.
- Delete/merge behavior.
- Missing context repair.
- Future collapse/expand region exploration only after stable basics.

### Stage 10: Stress, Accessibility, And Mobile Hardening

- Large dashboard tests.
- Many divider tests.
- Keyboard movement/management.
- Reduced motion.
- Mobile compact labels.
- Visual regression screenshots.

## Non-Goals

- Do not implement dividers as panels.
- Do not add widget-inside-divider behavior.
- Do not make dividers tabs.
- Do not use dividers as pages/routes.
- Do not create fake context functionality before the context engine exists.
- Do not globally repack the dashboard when adding or moving dividers.
- Do not let divider hover state change committed context.
- Do not make zone inheritance invisible.
- Do not implement column-scoped zones before full-width zones are stable.

## Success Criteria

Context Dividers succeed when users can visually and semantically organize a large dashboard without leaving the continuous workspace.

The system should feel:

- Spatial.
- Calm.
- Deterministic.
- Premium.
- Context-aware.
- Tabless.
- Compatible with groups and anchors.

The divider should read as a refined spatial boundary that gives nearby objects inherited meaning, not as a content panel, table row, or page separator.
