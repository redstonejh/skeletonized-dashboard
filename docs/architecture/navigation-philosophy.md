# Navigation Philosophy

## Purpose

Navigation should support a continuous spatial workspace without turning the product into tabs, routes, pages, or disconnected dashboards.

## Core Direction

Users should move through the workspace, not away from it.

Navigation means:

- Scroll to a target.
- Focus a region.
- Reveal a context path.
- Activate an anchor.
- Open a local control surface.
- Save or restore a viewport.

Navigation does not mean:

- Replace the workspace with a new page.
- Hide regions behind tabs.
- Convert dividers into section tabs.
- Make layout profiles feel like app pages.

## Navigation Layers

| Layer | Role | Should persist? |
| --- | --- | --- |
| Navbar/workspace chrome | Global commands | Yes as UI, not destination list |
| Spatial Anchors | Local return points | Yes |
| Context path | Shows active/inherited meaning | Yes as context records |
| Saved viewports | Return to camera/scroll positions | Future |
| Search/command | Find objects or contexts | Query state optional |
| Overview/minimap | Large workspace orientation | Future |

## Navbar Role

The navbar is global command chrome. It should stay minimal and should not become the primary navigation model.

Appropriate navbar responsibilities:

- Workspace/profile identity.
- Layout/profile save/load utilities.
- Add/create entry point.
- Group and Engineer modes. Context visibility belongs inside Engineer Mode rather than a separate normal-user toolbar mode.
- Anchor management entry point in the future.

Inappropriate navbar responsibilities:

- A tab strip of zones.
- A page router.
- A long destination list.
- A substitute for spatial anchors.

## Spatial Anchors

Anchors are the future local navigation layer.

They can behave like pseudo-tabs only in the sense that they let users return to important places. They must not become tabs visually, structurally, or mentally.

## Horizontal Expansions And Dropdowns

Workspace chrome may use:

- Horizontal expansion from clicked controls.
- Vertical dropdowns.
- Floating contextual menus.
- Temporary overlays that collapse to restore access.

Rules:

- Expanded controls must not permanently hide unrelated options.
- Menus should feel local to the clicked control.
- Command expansion should not mutate workspace layout.

## Semantic Navigation

Semantic navigation moves toward meaning:

- Region.
- Context.
- Object relationship.
- Active filter source.
- Saved workflow stage.

It should still resolve to spatial targets when possible.

## Reduced Motion

Reduced motion should preserve navigation clarity:

- Use instant or short movement.
- Move focus predictably.
- Announce target state.
- Avoid disorienting cinematic scroll.

## Open Questions

- Whether saved viewports are their own object class or an anchor subtype.
- Whether overview/minimap is necessary before many anchors exist.
- How context search interacts with anchor creation.
