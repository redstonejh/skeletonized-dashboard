# Glass styling instructions

Use this recipe to create the glass visual style for dashboard objects.

## Core rule

`glass = transparency + background bleed + sheen + rim light`  
not just blur.

## Base object

```css
.object {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(255,255,255,.22);
  backdrop-filter: blur(18px) saturate(1.25);
  box-shadow:
    0 10px 28px rgba(15,23,42,.16),
    inset 0 1px 0 rgba(255,255,255,.22);
}
```

## Directional sheen layer

```css
.object::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,.45) 0%,
      rgba(255,255,255,.12) 32%,
      rgba(255,255,255,0) 68%
    );
  opacity: .55;
  z-index: 1;
}
```

## Rim / edge lighting

```css
.object::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.55),
    inset 0 -1px 0 rgba(255,255,255,.16),
    inset 1px 0 0 rgba(255,255,255,.18),
    inset -1px 0 0 rgba(255,255,255,.18);
  z-index: 2;
}
```

## Keep content above glass layers

```css
.object > * {
  position: relative;
  z-index: 3;
}
```
