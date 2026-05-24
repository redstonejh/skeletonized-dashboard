# Background Palettes

The dashboard palette system separates accent color from workspace background tone. Background palettes shape the ambient workspace without changing widget accent identity, panel readability, or the shared glass material system.

There is no separate mode-specific component palette. Deep tones are only background colors.

## Bright Palettes

- `warm-white`: Warm neutral base for calm everyday work.
- `cool-white`: Cooler workspace with a crisp productivity feel.
- `soft-grey`: Quiet neutral grey.
- `cool-grey`: Grounded cool grey for modern productivity and design-tool workspaces.
- `medium-cool-grey`: Medium cool grey with clear separation from the white and frosted presets.
- `darker-soft-grey`: A darker soft grey that reduces glare.
- `warm-grey`: Soft industrial warm grey.
- `slate`: A richer slate with stronger ambient contrast.
- `slate-grey`: A calmer slate grey for neutral dashboards that need stronger ambient contrast.
- `graphite-light`: Premium lifted graphite tone.
- `graphite-grey`: The deepest lifted graphite grey.
- `light-blue-grey`: Restrained blue-grey.
- `muted-blue-grey`: More grounded blue-grey with less pastel wash.
- `blue-slate`: Darker blue-slate neutral with a cooler workspace feel.
- `neutral-dim`: Warm neutral dim workspace tone.
- `stone-slate`: Balanced stone/cool slate mix.
- `stone-grey`: Grounded stone grey for neutral, low-glare work.
- `industrial-grey`: Muted industrial grey with restrained saturation.
- `blue-mist`: Subtle blue mist.
- `frosted-light`: Default frosted neutral.

## Deep Palettes

- `black`: True low-luminance workspace background.
- `near-black`: Neutral near-black workspace background.
- `soft-black`: Deep low-light tone.
- `warm-near-black`: Warmer near-black workspace background.
- `charcoal`: Calm charcoal workspace background.
- `soft-charcoal`: Softer, lower-contrast charcoal.
- `graphite`: Lifted graphite tone.
- `gunmetal`: Cool metal grey background.
- `dark-grey`: Neutral deep grey background.
- `dark-blue-grey`: Neutral deep blue-grey.
- `deep-navy`: Restrained navy.
- `desaturated-dark-blue`: Muted blue background with low saturation.
- `muted-navy`: Calmer navy with reduced blue intensity.
- `muted-midnight-blue`: Deeper muted blue workspace.
- `deep-slate`: Cinematic deep slate background.
- `cool-dark-steel`: Cool steel-toned low-luminance background.
- `dark-steel`: Softer steel background.
- `soft-cinema`: Restrained cinematic near-black tone.
- `dark-frosted`: Dark frosted neutral.

## Contrast Guidance

- Panels, widgets, nav chrome, popovers, and settings surfaces must remain visibly separated from the workspace background through the shared material tokens.
- Background palettes must not override accent color, glass surface tokens, border tokens, shadow tokens, icon styling, or custom panel/widget color identity.
- Avoid pure white, washed-out pastel overload, cyberpunk neon, and glowing RGB edge effects.
- Hover and keyboard focus previews may temporarily apply a background tone, but persistence must happen only after explicit selection.
