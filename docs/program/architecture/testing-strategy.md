# Testing Strategy

## Objective

Define the test matrix for the extension-first platform so every major subsystem has a verification path before launch.

## Test Layers

### Unit Tests

Focus:

- schema validation
- domain normalization
- lock/session rules
- vault envelope encoding/decoding
- mock entitlements and plan catalog logic
- suggestion scoring
- pipelines callback verification

### Integration Tests

Focus:

- extension to API sync
- device enrollment and approval
- pipelines job lifecycle
- sealed artifact delivery
- recovery import/export behavior
- conflict resolution flows

### End-to-End Tests

Focus:

- sign-up detection and new fictional identity flow
- login detection and existing suggestion flow
- vault CRUD
- TOTP fill
- offline write then reconnect
- desktop/mobile autofill journeys

### Security Verification

Focus:

- server cannot decrypt vault contents
- signed callbacks are verified
- revoked device loses access
- recovery flow works without plaintext leakage
- logs and metrics exclude sensitive content

### UX / Accessibility Verification

Focus:

- onboarding comprehension
- unlock friction
- suggestion clarity
- responsive behavior
- keyboard/screen-reader usability
- reduced-motion behavior

## Suggested Tooling by Layer

- unit: TypeScript test runner for extension contracts and utils, plus backend test framework in future API repo
- integration: API contract tests, mock pipelines callbacks, encrypted fixture bundles
- browser e2e: Playwright-driven extension tests for Chrome and Firefox
- native e2e:
  - iOS simulator flows
  - Android emulator flows
- visual: screenshot review for extension popup, vault, and mobile shells

## Matrix by Program Area

### Extension

- detection heuristics
- autofill mapping
- popup behavior
- full vault behavior
- offline queue and sync replay
- Chrome/Firefox parity

### API

- auth and device APIs
- sync APIs
- domain suggestion APIs
- mock entitlement APIs
- audit/risk event storage

### Pipelines

- policy gate
- job status transitions
- artifact packaging
- callback signatures
- manifest integrity

### Desktop / Mobile

- secure unlock
- system autofill integration
- sync and conflict handling
- recovery flows
- generated persona review

## Release Gates

### Pre-Alpha

- core contracts stable
- critical journeys modeled
- no unresolved architecture ambiguity on encryption or sync

### Alpha

- extension/API happy path works
- pipelines returns sealed artifacts
- zero-knowledge assumptions validated

### Beta

- cross-browser parity
- desktop/mobile core flows validated
- recovery and device approval reliable

### GA

- security verification complete
- accessibility checks pass
- store/package assets ready
- no unresolved P0 issues in critical journeys
