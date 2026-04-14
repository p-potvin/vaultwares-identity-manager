# EPIC-01: Branding, UI/UX Skeleton, Encryption Flow

## Goal

Define the visual identity, trust language, interaction model, and encryption-facing user experience for VaultWares Identity Manager before deep implementation begins.

## Why This Epic Comes First

- branding is still undecided and is now the highest priority
- the extension is the first delivery surface and needs a stable interaction language
- encryption and recovery flows are product-defining and must be understandable before code-level implementation
- desktop and mobile should inherit a shared system rather than invent their own

## Inputs

- `vault-themes` token system and theme manager
- current extension prototype in `src/popup`, `src/content`, and `src/vault`
- adjacent VaultWares interaction patterns from `vault-central`
- official browser/mobile autofill UX constraints
- Canva as the main visual board and mockup tool

## Outputs

- brand strategy brief
- semantic token spec mapped from `vault-themes`
- extension popup and full-vault shell skeleton
- desktop/mobile shell skeletons
- encryption and recovery journey maps
- Canva moodboard, sitemap, low-fi/hi-fi screens, and review inventory

## Brand Direction Principles

- premium trust console, not “hacker aesthetic”
- privacy-first and calm, not militaristic or fear-driven
- modern, sleek, colorful, and minimal within VaultWares theme constraints
- subtle motion only where it sharpens clarity or delight
- obvious trust cues for encryption, device ownership, sync state, and risk boundaries

## Workstreams

### 1. Theme Audit and Candidate Skins

- audit all current `vault-themes` presets
- shortlist 2-3 candidate default skins for product exploration
- define dark/light pair strategy for the extension and companion apps
- translate raw theme outputs into semantic UI tokens

### 2. Brand Foundation

- define name usage, tone, value proposition, and trust language
- define icon direction, illustration rules, and empty-state style
- define typography hierarchy and spacing rhythm
- define product copy tone for onboarding, warnings, success states, and sensitive actions

### 3. UX Skeleton

- extension popup IA
- full vault IA
- desktop shell IA
- iOS shell IA
- Android shell IA
- command surfaces for signup detection, login suggestion, and vault management

### 4. Encryption and Recovery UX

- first-run account creation
- PIN creation and local unlock
- device registration and approval
- recovery kit export/import
- lost-device recovery flow
- sync conflict and re-auth messaging

### 5. Canva Program

- create a Canva workspace structure with:
  - moodboard
  - visual language board
  - sitemap
  - extension screens
  - desktop screens
  - iOS screens
  - Android screens
  - encryption/recovery diagrams
- define review and handoff naming conventions for Canva artifacts

## Suggested Backlog Seeds

- issue seed: audit `vault-themes` and select candidate skins
- issue seed: define semantic token map for Identity Manager
- issue seed: create brand strategy brief and copy tone guide
- issue seed: create Canva moodboard and navigation sitemap
- issue seed: design extension popup shell and login/signup suggestions
- issue seed: design full vault shell for browser/desktop
- issue seed: design mobile vault shells for iOS and Android
- issue seed: design encryption, recovery, and device-approval flows
- issue seed: define accessibility, motion, and responsive rules

## Dependencies

- ADR-001 product boundary
- ADR-002 zero-knowledge model
- `ux/brand-foundation.md`
- `ux/canva-board-index.md`
- `ux/core-user-journeys.md`
- `ux/encryption-flow.md`

## Acceptance Criteria

- a final candidate visual direction exists with named token mapping
- extension, desktop, and mobile shells are visually aligned
- encryption and recovery flows are understandable without technical jargon
- Canva contains a structured artifact set for the critical journeys
- product copy and trust cues reflect the fictional-persona boundary clearly

## Definition of Done

- approved brand foundation
- approved semantic tokens
- approved screen skeletons for extension, desktop, iOS, and Android
- approved encryption/recovery UX diagrams
- linked follow-on requirements for `EPIC-02` and `EPIC-03`
