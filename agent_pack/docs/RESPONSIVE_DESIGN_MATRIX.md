# A4 Responsive Design Matrix — Fixed Arabic RTL

## Shell matrix

| Width | Navigation | Content | Overlays |
|---:|---|---|---|
| 320–599px | right temporary drawer, top bar 58px | 12–14px padding, single column | full-screen when long |
| 600–899px | right temporary drawer, top bar 64px | 16px padding | capped or full-screen by workflow |
| 900–1199px | right permanent collapsible sidebar | 20–22px padding | sized drawers/dialogs |
| 1200–1535px | 282px / 76px sidebar | full split layouts | sized overlays |
| 1536px+ | same shell | max content 1680px except POS | sized overlays |

## Required viewports

- 360×800
- 390×844
- 768×1024
- 1024×768
- 1366×768
- 1440×900
- 1920×1080
- Desktop at 125% zoom

## Universal assertions

- No page-level horizontal overflow.
- Sidebar, top bar, and main offsets are correct in RTL.
- No label, placeholder, helper text, or validation overlap.
- No outlined-field notch appears.
- Arabic text wraps naturally.
- Technical values remain isolated without changing page direction.
- Buttons, filters, and action rows wrap or stack instead of clipping.
- Tables scroll only inside their own container or switch to record cards.

## POS

- Desktop: catalog and sticky cart remain usable together.
- Tablet: cart moves below or into a controlled panel without compressing catalog cards.
- Phone: product results, cart total, checkout, preorder, and pickup remain reachable with clear primary action.
- Scanner/search input is not hidden by the keyboard or sticky elements.

## Forms and lists

- Two-column forms become one column below 720px.
- Page-header actions take full width when needed.
- Entity drawer becomes full-screen on phones.
- Filter fields use one column on phone, two on tablet, and auto-fit on desktop.
- Confirmation actions remain visible and large enough for touch.

## Receipts

- On-screen preview scales to viewport.
- Physical 58/80mm receipt dimensions remain stable in print.
- Dark mode never changes printed background/text.
