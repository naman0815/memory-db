# Product

## Register

product

## Platform

web

## Users

Primarily a single person's personal daily-use tool: one user, capturing notes, tickets, passwords, and photos throughout the day on their phone, then retrieving them later by asking a plain-language question rather than searching folders. There's no multi-tenant or team use case inside a single deployment today.

Two secondary paths the product is deliberately open to: anyone can fork the repo and deploy their own separate instance (already true — the app is public, and Vercel + Neon setup was built specifically to make this straightforward for someone else to stand up their own copy), and a future direction where multiple people share one deployment with distinct accounts rather than the current single sync-code-per-instance model. That second path is aspirational, not yet built — the sync code today is a single shared secret per deployment, not per-person auth.

## Product Purpose

Brain 2 is a personal memory store: tell it something ("remember my locker code is 4421", a photo of a ticket, a voice note), and later ask for it back in plain language. Success is a fast, low-friction capture (a couple taps, no forms to fill) and an even faster recall — asking "what's my wifi password" or "when's my flight" gets a direct, correct answer instead of requiring the user to remember which note it's in or scroll a list.

## Positioning

Ask it, don't search it. Every other notes app makes you find your own note; Brain 2 answers the question directly, in your own words, grounded strictly in what you actually saved.

## Brand Personality

Calm, warm, precise. Calm: no urgency, no gamification, no engagement bait — this is closer to a diary than a productivity dashboard. Warm: cream/terracotta palette, serif type, personal rather than corporate. Precise: answers are deterministic and grounded — the app would rather say "I don't have that stored" than guess, and structured fields (dates, ticket numbers, fields) are extracted with regex, not fabricated by a model.

## Anti-references

Not corporate SaaS or a productivity tool. No gradient-hero-metric dashboards, no blue/purple enterprise palette, no cluttered toolbars or dense data tables. This should never read like an admin panel or an analytics tool — it's a personal, almost diary-like space.

## Design Principles

- Answer, don't make the user search. Every design decision on the retrieval side should shorten the distance between "I need this fact" and "I have this fact."
- Never fabricate. Deterministic extraction and grounded answers over confident-sounding guesses; the interface should make it obvious when something wasn't found rather than paper over it.
- Capture must stay under a few taps. Any friction added to saving something (extra fields, required categorization, confirmation dialogs) works against the core loop and needs a strong reason to exist.
- Calm over urgent. No streaks, badges, engagement nudges, or attention-grabbing color outside of what's needed for legibility and brand warmth.
- Personal, not enterprise. When in doubt between a SaaS-dashboard pattern and a simpler, warmer one, take the warmer one.

## Accessibility & Inclusion

Standard care: solid contrast and readable type, and `prefers-reduced-motion` is already respected throughout the animation system. No formal WCAG compliance target — this is a personal tool (and a fork-it-yourself template for others), not a public product under legal accessibility requirements.
