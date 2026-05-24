# Background Presets

## Purpose

Background presets provide subtle workspace atmosphere while preserving contrast, readability, glass depth, and dashboard focus.

They are not wallpapers and should not become decorative theme chaos.

## Bright Presets

- `warm-white`: A warm neutral workspace tone.
- `cool-white`: A cooler white workspace tone.
- `soft-grey`: A quiet neutral grey.
- `cool-grey`: A grounded cool grey for modern productivity workspaces.
- `medium-cool-grey`: A medium cool grey with visibly stronger contrast.
- `darker-soft-grey`: A darker soft grey for reduced glare.
- `warm-grey`: A soft industrial warm grey.
- `slate`: A richer slate with stronger ambient contrast.
- `slate-grey`: A neutral slate grey with less blue wash.
- `graphite-light`: A premium lifted graphite tone.
- `graphite-grey`: A deeper light graphite grey.
- `light-blue-grey`: A restrained blue-grey.
- `muted-blue-grey`: A richer muted cool background with less pastel wash.
- `blue-slate`: A grounded blue-slate neutral.
- `neutral-dim`: A soft neutral dim workspace tone.
- `stone-slate`: A balanced stone and slate neutral.
- `stone-grey`: A grounded stone grey.
- `industrial-grey`: A muted industrial grey.
- `blue-mist`: A subtle blue mist.
- `frosted-light`: The default light frosted neutral.

## Deep Presets

- `black`: A true low-luminance workspace background.
- `near-black`: A neutral near-black workspace background.
- `warm-near-black`: A warmer near-black workspace background.
- `charcoal`: A calm charcoal workspace background.
- `soft-charcoal`: A softer low-contrast charcoal.
- `graphite`: A slightly lifted graphite tone.
- `soft-black`: A deeper low-light tone.
- `gunmetal`: A cool metal grey background.
- `dark-grey`: A neutral deep grey background.
- `deep-navy`: A restrained navy atmosphere.
- `muted-navy`: A calmer navy with reduced blue intensity.
- `dark-blue-grey`: A dark blue-grey neutral.
- `desaturated-dark-blue`: A muted blue background with low saturation.
- `muted-midnight-blue`: A deeper muted blue workspace.
- `deep-slate`: A cinematic deep slate background.
- `cool-dark-steel`: A cool steel-toned low-luminance background.
- `dark-steel`: A softer steel background.
- `soft-cinema`: A restrained cinematic near-black tone.
- `dark-frosted`: A dark frosted neutral.

Detailed palette intent and contrast guidance live in `docs/theme-palettes.md`.

## Rules

- Presets must update only `--bg` and `--bg-end`.
- Presets must not override accent color.
- Presets must not reduce text contrast.
- Presets must not flatten glass surfaces.
- Presets must not require component-specific overrides.
- Presets must not change component borders, shadows, gradients, icon styling, hover/focus behavior, or glass material geometry.
- New presets require visual checks on dashboard, settings, forms, popovers, and modals.

## Toolbar Integration

Background selection is an appearance/environment action in the workspace toolbar.

- The background tone control should live with appearance/environment actions and settings.
- Changing background tone should not change active accent color.
- Hovering or focusing a background option may preview that tone live, but it must revert when the user leaves without selecting.
- Command islands must remain legible and elevated above every background preset.
- Toolbar screenshots should cover at least one bright preset and one deep preset.

## Testing

Visual checks should include:

- Dashboard on default and deep backgrounds.
- Dashboard with at least two background tones.
- Settings page with form fields.
- Dropdowns and popovers.
- Dialogs or modal-like surfaces.
- Multiple accent colors combined with multiple backgrounds.
