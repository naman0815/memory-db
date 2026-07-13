---
name: Brain 2
description: Ask it, don't search it — a personal memory store with one warm terracotta accent.
colors:
  paper: "#ede7db"
  paper-dark: "#1b1a17"
  surface: "#f6f2e7"
  surface-dark: "#242320"
  ink: "#2b2620"
  ink-dark: "#ece7db"
  ink-muted: "#706555"
  ink-muted-dark: "#a99f89"
  ink-muted-2: "#5b5138"
  ink-muted-2-dark: "#cbbfa0"
  hairline: "rgba(43, 38, 32, 0.1)"
  hairline-dark: "rgba(255, 255, 255, 0.1)"
  hairline-strong: "rgba(43, 38, 32, 0.22)"
  hairline-strong-dark: "rgba(255, 255, 255, 0.22)"
  terracotta: "#de7356"
  terracotta-wash: "rgba(222, 115, 86, 0.16)"
  terracotta-wash-active: "#f8ddd3"
  terracotta-wash-active-dark: "#3a261f"
  ink-well: "#241f19"
  ink-well-fg: "#efeae0"
  btn-text: "#2b2620"
  error-text: "#a5333a"
  error-text-dark: "#e17075"
  danger: "#c93f44"
typography:
  display:
    fontFamily: "EB Garamond, serif"
    fontSize: "34px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "EB Garamond, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "EB Garamond, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0.1px"
  label:
    fontFamily: "EB Garamond, serif"
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.5px"
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "0.9em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px"
  chip-tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  chip-tag-active:
    backgroundColor: "{colors.terracotta-wash}"
    textColor: "{colors.terracotta}"
---

# Design System: Brain 2

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

Brain 2 reads like a personal ledger, not a productivity dashboard: warm paper background, ink-brown (or ink-cream, in dark) body text, hairline borders doing almost all the separating work. Against that quiet neutral field sits exactly one accent — a warm terracotta, used the way a ledger uses red ink: sparingly, on the entries that matter (an active state, a primary action, an icon), never as decoration. This follows Claude's own brand language directly — a warm rust accent (Crail-family orange) against off-white/near-black neutrals, deliberately with no blues anywhere in the system — adapted to Brain 2's own palette and EB Garamond serif voice.

The system explicitly rejects the corporate-SaaS look: no gradient hero metrics, no blue/purple accent, no dense toolbars or data tables. It's closer to a notebook than an admin panel — calm, warm, and precise, matching Brain 2's own product personality.

**Key Characteristics:**
- One accent only. Terracotta (`#de7356`) is the single saturated color in the entire system — every button, active state, and icon draws from it. No second or third accent color exists.
- Flat by default. Hairline borders (10–22% opacity) separate content; shadow is reserved for the two elements that are genuinely floating above the page.
- Full light/dark parity. Every token has a dark counterpart; the terracotta accent itself does not change between themes — it's the one constant across both.
- Generous, soft rounding. Pills for actions, 16–20px radii for cards and the modal — nothing sharp-cornered.

## 2. Colors

Warm neutrals carry the page; terracotta carries meaning. No blues, no purples, no gray-scale-only surfaces — every neutral is warm-tinted toward the same hue family as the accent.

### Primary

- **Warm Terracotta** (`#de7356`): The one accent. Primary button fills, active states (segmented control, toggle switch, pinned-tile border, tag chips), all icon glyphs (category icons, plus/mic, eye/reveal, settings gear, pin, delete). Identical value in light and dark — it's the fixed point the rest of the palette rotates around.
- **Terracotta Wash** (`rgba(222, 115, 86, 0.16)` light / `rgba(222, 115, 86, 0.22)` dark): Soft background tint behind masked-secret spans and inactive segmented/tag states — terracotta present without shouting.
- **Terracotta Wash, Active** (`#f8ddd3` light / `#3a261f` dark): The filled background for an active/selected tile (e.g. a pinned category tile) — a paler (light) or deeper (dark) wash of the same hue, always paired with a full-strength terracotta border.

### Neutral

- **Paper** (`#ede7db` light / `#1b1a17` dark): Page background. A warm off-white in light mode (the Pampas-family tone Claude's own palette uses), a warm near-black in dark — never a cool or neutral gray.
- **Surface** (`#f6f2e7` light / `#242320` dark): Card, tile, and input backgrounds — one step lighter (light mode) or lighter-than-paper (dark mode) than the page itself, giving cards just enough lift to read as distinct without a shadow.
- **Ink** (`#2b2620` light / `#ece7db` dark): Primary text. Warm near-black on paper; warm near-white on dark paper — never pure `#000`/`#fff`.
- **Ink Muted** (`#706555` light / `#a99f89` dark): Secondary text — tile subtitles, timestamps, hints. (Darkened from an earlier `#948a72`, which measured ~3:1 against both Paper and Surface in light mode — below WCAG AA's 4.5:1 floor for this text size.)
- **Ink Muted 2** (`#5b5138` light / `#cbbfa0` dark): A second muted step, used sparingly (e.g. restore-backup hint copy) where Ink Muted is too light against its background.
- **Hairline** (`rgba(43,38,32,0.1)` light / `rgba(255,255,255,0.1)` dark): The default border — nearly invisible, just enough to separate a card from the page.
- **Hairline, Strong** (`rgba(43,38,32,0.22)` light / `rgba(255,255,255,0.22)` dark): Used for interactive borders (segmented control, inputs, secondary buttons) that need to read as a boundary, not just a seam.
- **Ink Well** (`#241f19`) / **Ink Well Foreground** (`#efeae0`): A fixed dark circle (not theme-dependent) behind the composer's send icon — the one place a near-black fill appears deliberately, for contrast against the terracotta/paper field around it.
- **Button Text** (`#2b2620`, fixed across both themes): Text color for anything filled with Terracotta. Deliberately not Ink — Ink flips to near-white in dark mode, which would put light text on a background that doesn't get any darker, failing contrast (~2.55:1). A fixed dark ink passes AA against Terracotta in both themes (~4.76:1).
- **Error Text** (`#a5333a` light / `#e17075` dark): Status-message text for a failed action (e.g. "Restore didn't work"). Needs its own per-theme pair, same reasoning as Button Text — a red dark enough to read on Paper is nowhere near light enough to read on dark Paper.

### Named Rules

**The One Accent Rule.** Terracotta is the only saturated color anywhere in the system. If a new UI element needs to stand out, it uses terracotta or it uses type-weight/size — never a second hue. A gold/tan accent existed earlier in this project's history and has been fully retired in favor of this rule.

**The No-Blue Rule.** No blue or purple appears anywhere in Brain 2's palette, matching Claude's own brand language. Links, focus rings, and interactive states all resolve to terracotta, not a system-default blue.

## 3. Typography

**Display/Body Font:** EB Garamond (with `serif` fallback) — a single family for everything, weight and size doing the differentiation rather than a second typeface.
**Label/Mono Font:** `ui-monospace, Consolas, monospace` — reserved for the sync code and masked secret values, where character-for-character legibility matters more than voice.

**Character:** Old-style Garalde serif throughout gives Brain 2 its "ledger" feel — warm, slightly literary, never a geometric sans pretending to be a tool. One family in three weights (400/500/600, plus 400 italic) instead of a display/body pairing keeps the voice singular.

### Hierarchy

- **Display** (500, 34px, -0.01em letter-spacing): The "Hello, [name]" greeting — the only place a heading gets real size. One per screen, at most.
- **Title** (400, 17px): Section headers ("Pinned stuff", "Recent things", "Answer") and the note-editor textarea — same size as body, distinguished by weight-neutral placement rather than a size jump.
- **Body** (400, 17px/145%, 0.1px letter-spacing; 16px below 1024px width): Note text, card content, settings copy. Line length isn't hard-capped by CSS but the 480px max app width keeps it well under 75ch.
- **Label** (400, 10px, 0.5px letter-spacing, uppercase): The type badge on memory cards (`NOTE`, `TICKET`, ...) — the only uppercase-tracked text in the system, used exactly once per card.
- **Mono** (0.9em): Masked secret values and the sync code — monospace exclusively for values a user needs to read character-by-character.

### Named Rules

**The Single-Voice Rule.** One serif family, no second typeface for contrast. Hierarchy comes from size, weight, and the 10px uppercase label — never from switching fonts.

## 4. Elevation

Flat by default. Hairline borders do the separating almost everywhere — cards, tiles, inputs, and the segmented control all sit at the same visual plane as the page, distinguished only by a 1px border and a slightly lighter/darker surface color. Shadow is reserved for the two elements that are genuinely floating above the page content: the fixed composer bar at the bottom of Home, and the centered note-editor modal. When a shadow appears, it signals "this is above the page," not "this card is fancy."

### Shadow Vocabulary

- **Floating** (`box-shadow: 0 10px 30px rgba(30,25,15,0.14)` light / `rgba(0,0,0,0.4)` dark): The one shadow token in the system. Used on `.home-composer` and `.memory-detail` only.

### Named Rules

**The Flat-By-Default Rule.** Nothing gets a shadow just for being a card. A shadow is earned by actually floating above the page (fixed position or a modal); everything else uses a 1px hairline border instead.

## 5. Components

Soft and unhurried: generous rounding, gentle opacity-based tap feedback (never a harsh color-snap or a layout-shifting press state), no sharp corners anywhere in the system.

### Buttons

- **Shape:** Every button is a full pill (`border-radius: 999px`) — Save, Settings actions, and the note-editor's Save/Delete all unified to this shape; an earlier inconsistency (10px radius in two of the three places) was corrected during the app-wide polish pass.
- **Primary:** Terracotta fill (`--icon-color`), Button Text (`--btn-text`, fixed dark ink in both themes — see Colors), no border. Used for Save, Restore-from-backup, Turn-on-backup, and the segmented control's active state.
- **Secondary/Ghost:** Transparent background, `border: 1px solid var(--border-strong)`, ink-colored text — "Cancel," "Turn off backup," the non-active segmented options.
- **Danger:** The one deliberate exception to the One Accent Rule — delete-confirmation uses `#c93f44` (white text on this measures ~4.9:1; the original `#e5484d` only cleared ~3.9:1), never terracotta, so a destructive action is never visually confusable with a normal primary action. Every destructive action — the quick delete on a Brain-tab card and the note editor's Delete — requires the same two-tap confirm; there's no single-tap delete anywhere in the system.
- **Icon-only:** 44px minimum hit target (WCAG 2.5.5), transparent background, terracotta glyph (`.home-round-btn`, `.icon-btn-inline`) — used for plus/mic/eye/close. The glyph itself stays visually small; only the invisible tappable area is 44px.

### Chips (Tags)

- **Style:** No background, no border — plain text at 12px, 70% opacity, terracotta wash background only when actively filtering (`.tag.active`).
- **Secret span:** A distinct chip variant — monospace, terracotta-wash pill background, dotted by default, tap to reveal the real value. Visually similar to a tag chip but never confusable with one (rounded 4px vs. tag's plain text).

### Cards / Containers

- **Corner Style:** 16px for tiles and horizontal-scroll cards (`.home-tile`, `.home-hcard`), 10px for the denser Brain-tab memory list (`.memory-card`), 20px for the note-editor modal.
- **Background:** `--card-bg` (Surface), one step lighter than the page.
- **Shadow Strategy:** None — see Elevation. Cards separate from the page via a 1px hairline border only.
- **Border:** `1px solid var(--border)` at rest; active/selected states swap to a full-strength terracotta border plus a Terracotta Wash Active background.
- **Internal Padding:** 12–16px, consistent across tile/card variants.

### Inputs / Fields

- **Style:** No visible border at rest inside the composer (transparent, blends into the card); explicit `1px solid var(--border-strong)` on standalone inputs (settings name field, sync-code entry) and the note-editor textarea.
- **Focus:** A 2px terracotta outline (`outline: 2px solid var(--icon-color)`), offset 1px — never a color/border swap, always the same outline treatment everywhere it appears.
- **Composer specifically:** Auto-growing textarea (not a single-line input) — Enter inserts a newline; only the Send/Ask button submits.

### Navigation

- Top nav is text-only (`Home` / `Brain` at 22px, muted until active, full-weight ink when active) plus a single terracotta-glyph settings icon on the right. No background, no pills, no icons on the primary tabs — the simplest possible nav for a two-tab app.

### The Note-Editor Modal (signature component)

Centered overlay (not a bottom sheet), `popIn` scale+fade entrance, 20px radius, capped at 88svh with an internally scrolling body. Opens directly into an editable, generously sized textarea (40–55vh) with no separate "edit mode" toggle — but does not autofocus on open, so the keyboard only appears once the user actually taps into the text. A small top-right close control (the existing "plus" glyph rotated 45°, reused rather than adding a new icon) and a bottom action row (Save / Delete) complete it.

## 6. Do's and Don'ts

### Do:

- **Do** use terracotta (`#de7356` / `var(--icon-color)`) for every icon, active state, and primary button — it is the only accent in the system.
- **Do** keep shadows to the two floating elements (composer, modal); everything else uses a 1px hairline border.
- **Do** use the 999px pill radius for primary actions and 16–20px radii for cards/tiles/the modal — soft and unhurried, never sharp-cornered.
- **Do** let EB Garamond carry the whole hierarchy through size and weight; reach for the 10px uppercase label sparingly (once per card, for the type badge).
- **Do** use opacity-only transitions for tap feedback and card entrances — GPU-composited, no layout shift, and avoids the iOS Safari black-flash bug this project hit earlier when `transform` was combined with `border-radius`.

### Don't:

- **Don't** introduce a second accent color. No gold, no blue, no purple — this was a real earlier state of the project (a `#c9a85b` gold accent) and has been fully retired; don't reintroduce it.
- **Don't** add a shadow to a card "to make it pop." Shadow means "floating above the page," not "important."
- **Don't** reach for a second typeface for contrast or hierarchy. One serif family, weight and size only.
- **Don't** build gradient-hero-metric sections, dense toolbars, or data-table-dense views — this is a personal ledger, not a SaaS dashboard or admin panel (per PRODUCT.md's anti-references).
- **Don't** use a side-stripe (`border-left`) as a colored accent anywhere — full borders, background tints, or nothing.
