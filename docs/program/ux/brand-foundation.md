# Brand Foundation

## Brand Thesis

VaultWares Identity Manager should feel like a calm, premium privacy instrument: confident, elegant, and modern. It must avoid both “consumer toy” softness and “cybersecurity hacker” theatrics.

## Product Promise

Give users a believable fictional identity layer for online life so unknown companies cannot casually collect and resell their real-world personal information.

## Tone of Voice

- clear, restrained, and confident
- privacy-educational without sounding paranoid
- premium but not corporate-stiff
- explicit when discussing trust, encryption, device approval, and recovery
- never glamorize abuse or anonymity theater

## Visual Principles

- use VaultWares theme tokens rather than ad-hoc colors
- preserve strong contrast and explicit light/dark support
- use discreet gradients and glass effects sparingly
- prefer generous spacing and obvious hierarchy over dense chrome
- use motion to clarify transitions, unlock states, and suggestions

## Candidate Default Skins

These are the initial candidates based on `vault-themes` and current VaultWares style guidance:

### Candidate A: Cyberpunk Cinder

- mode: dark
- base: muted blue-gray
- accent: warm orange
- fit: strongest default candidate for the extension and power-user surfaces

### Candidate B: Golden Slate

- mode: dark
- base: dark gray-blue
- accent: gold
- fit: strongest candidate for premium vault surfaces and trust-heavy settings screens

### Candidate C: Ocean Mist

- mode: light
- base: soft light neutral
- accent: deep sea blue
- fit: strongest light-mode counterpart for onboarding, account, and educational surfaces

## Semantic Token Layer

Map raw theme exports into these semantic roles:

- `bg-app`
- `bg-surface`
- `bg-surface-elevated`
- `border-subtle`
- `text-primary`
- `text-secondary`
- `accent-primary`
- `accent-hover`
- `focus-ring`
- `status-success`
- `status-warning`
- `status-danger`
- `suggest-signup`
- `suggest-login`
- `trust-verified`
- `trust-caution`

## Typography

- default: Segoe UI Semilight / closest native equivalent by platform
- monospace only for recovery keys, codes, or encrypted IDs
- large headings should feel calm and premium, not heroic
- trust messages should use short sentence case, not alert-shouting

## Icon Direction

- geometric, simple, slightly rounded
- shield/identity/device metaphors are acceptable if used sparingly
- avoid lock overload and cliché spy imagery
- prefer consistent stroke weight across extension and native clients

## Motion Direction

- quick fade/slide for popup transitions
- subtle emphasis when a sign-up or login suggestion is detected
- lock/unlock transitions should reinforce state, not showmanship
- avoid continuous looping motion outside explicit processing states

## Trust Cues

- encrypted and local-unlock status should always be visible in sensitive screens
- device approval should feel deliberate and serious
- recovery actions should use distinct caution styling
- suggestions should explain whether they are:
  - existing identity for this domain
  - new fictional identity
  - login credential suggestion

## Copy Style Examples

- good: “Use an existing identity linked to this domain”
- good: “Generate a new fictional identity for this sign-up”
- good: “Export your recovery kit before adding a new device”
- avoid: “Become untraceable”
- avoid: “Spoof your identity instantly”

## Handoff Notes

- Canva boards should use semantic token names in notes where possible
- implementation teams should consume semantic tokens, not the raw candidate theme list directly
- final theme selection can happen after the first Canva review cycle, but semantic roles should be stable before implementation
