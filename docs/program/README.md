# VaultWares Identity Manager Program

## Purpose

This document pack turns `vaultwares-identity-manager` into the planning anchor for the full Identity Manager program until the API, desktop, iOS, and Android codebases are split into sibling repositories.

The immediate priorities are:

1. `EPIC-01 Branding/UI/UX`
2. `EPIC-02 Web Extension / Database / API`

Everything related to payment execution, burner numbers, IP address products, and other high-cost infrastructure remains mocked or research-only until the legal entity, funding, and provider strategy are ready.

## Product Definition

VaultWares Identity Manager is a privacy-first identity vault that lets users:

- store encrypted logins, addresses, cards, TOTP seeds, notes, files, and related metadata
- generate fully fictional but realistic personas for online sign-ups
- detect sign-up and login pages in the browser and suggest either a new fictional identity or an existing domain-linked one
- manage the same encrypted vault across browser, desktop, iOS, and Android clients

The product is explicitly **not** intended for impersonation, KYC bypass, forged identity documents, reference-image cloning, or evasive abuse automation.

## Current Workspace Anchors

- `vaultwares-identity-manager/`
  - current browser-extension prototype
  - current planning anchor
- `vault-themes/`
  - source of truth for VaultWares theme primitives and token export
- `vault-central/`
  - reference for PIN/unlock flows, browser-extension UX, and existing VaultWares interaction patterns
- `vaultwares-pipelines/`
  - existing FastAPI/Postgres/AI orchestration foundation that will be expanded into a more global backend platform

## Program Scope

### In Scope

- brand definition and UI/UX foundation
- extension-first product architecture
- encrypted sync, device registration, and recovery flows
- extension, desktop, iOS, and Android planning
- database, API, and pipelines integration planning
- mock subscription and entitlement surfaces
- research briefs for deferred commercial systems and go-to-market work

### Out of Scope for This Phase

- real payment processing
- real crypto settlement
- real telecom/provider integration for phone numbers
- real network/static-IP product implementation
- forged official documents, KYC bypass media, or reference-image persona generation

## Future Repo Map

Until codebases are split, all program design documents live here.

Planned sibling repos/services:

- `vaultwares-identity-manager`
  - browser extension
  - shared planning anchor
- `vaultwares-identity-api`
  - account, sync, device, entitlement, and orchestration APIs
- `vaultwares-identity-desktop`
  - desktop companion app
- `vaultwares-identity-ios`
  - iOS app + Password AutoFill extension
- `vaultwares-identity-android`
  - Android app + AutofillService
- `vaultwares-pipelines`
  - AI generation and artifact orchestration backend
- `vaultwares-website`
  - public marketing site to be revamped later

## Release Order

### Phase 1

- finalize branding direction and UX skeleton
- reshape the extension architecture
- define the global API/database/data-contracts
- define the zero-knowledge encryption model

### Phase 2

- connect extension, API, and pipelines
- complete encrypted sync and domain suggestion behavior
- stabilize testing and rollout gates

### Phase 3

- deliver desktop app as a full vault-management client
- deliver iOS and Android full clients with system autofill support
- keep paid/telecom/network features mocked

### Phase 4

- complete deferred commercial and growth research
- decide future payment, telecom, IP, pricing, and marketing direction
- revamp `vaultwares-website`

## Document Index

### Epics

- `epics/EPIC-01-branding-ux.md`
- `epics/EPIC-02-extension-api-data.md`
- `epics/EPIC-03-encryption-integration.md`
- `epics/EPIC-04-desktop-mobile-qa.md`
- `epics/EPIC-05-research-go-to-market.md`

### ADRs

- `adrs/ADR-001-product-boundary.md`
- `adrs/ADR-002-zero-knowledge-model.md`
- `adrs/ADR-003-repo-boundaries.md`

### UX

- `ux/brand-foundation.md`
- `ux/canva-board-index.md`
- `ux/core-user-journeys.md`
- `ux/encryption-flow.md`

### Architecture

- `architecture/system-overview.md`
- `architecture/data-contracts.md`
- `architecture/testing-strategy.md`

### Backlog

- `backlog/github-issue-seeds.md`

### Research

- `research/briefs/billing-best-practices.md`
- `research/briefs/phone-number-provider-landscape.md`
- `research/briefs/ip-network-offering.md`
- `research/briefs/pricing-packaging.md`
- `research/briefs/marketing-strategy.md`
- `research/briefs/seo-content-plan.md`
- `research/briefs/website-revamp-brief.md`

## Glossary

- **Artifact Manifest**: a metadata object describing the generated encrypted outputs for a persona bundle.
- **Domain Profile**: normalized metadata about a site or domain cluster used to drive login/sign-up suggestions.
- **Fictional Persona**: a realistic, synthetic, non-user-supplied identity profile generated for privacy-preserving consumer use.
- **Recovery Kit**: an exported user-controlled bundle required to regain access when devices are lost.
- **Vault Item**: any encrypted record stored in the identity vault, such as a login, card, note, file, TOTP seed, or persona fragment.
- **Zero-Knowledge Client-First**: a trust model where the API stores ciphertext and wrapped keys, while clients own vault decryption.
