# EPIC-04: Desktop, Mobile, Mock Data, Tests, Finishing Touches

## Goal

Deliver full companion clients and a release-grade QA and polish plan after the extension/API/encryption core is stable.

## Outputs

- desktop PRD
- iOS PRD
- Android PRD
- mock-data service catalog
- QA matrix
- release checklist

## Product Positioning

Desktop and mobile are first-class vault-management clients, not thin companions. Each platform must support secure vault management, unlock/recovery, sync, and generated persona review. Mobile must also support system credential-manager behavior through native platform autofill APIs.

## Workstreams

### 1. Desktop Client

- define desktop app scope and platform technology choice
- support vault browsing, item CRUD, generated artifact review, device approval, recovery kit workflows, and mock account/plan views
- support local secure storage and session locking

### 2. iOS Client

- define full iOS app IA and SwiftUI shell
- define Password AutoFill extension behavior
- define secure enclave/keychain expectations
- define TOTP, login suggestion, and account-device management behavior

### 3. Android Client

- define full Android app IA and native shell
- define `AutofillService` behavior
- define encrypted local cache and unlock behavior
- define TOTP, login suggestion, and account-device management behavior

### 4. Mock Data Services

- define simulated plan catalog, entitlements, invoices, phone products, and IP products
- ensure UI surfaces can be built and tested without real providers
- define mock states for upgrades, pending verification, unavailable regions, and future features

### 5. QA Matrix

- cross-client sync coverage
- onboarding and recovery coverage
- platform autofill coverage
- accessibility coverage
- animation/performance coverage
- offline/reconnect coverage

### 6. Finishing Touches

- empty states, edge-state copy, and trust cues
- store-ready iconography and screenshots
- packaging and submission checklists
- release-note and migration-note templates

## Suggested Backlog Seeds

- issue seed: define desktop information architecture and secure storage expectations
- issue seed: define iOS app + Password AutoFill extension PRD
- issue seed: define Android app + AutofillService PRD
- issue seed: define mock plan and premium-product catalog for UI/testing
- issue seed: define cross-platform QA matrix and fixtures
- issue seed: define release checklist, store metadata, and polish pass

## Dependencies

- `EPIC-01` UX system
- `EPIC-02` extension/API/data contracts
- `EPIC-03` encryption and recovery model
- `architecture/testing-strategy.md`

## Acceptance Criteria

- desktop/iOS/Android are specified as first-class apps
- mobile autofill/default-manager behavior is concrete
- mock service surfaces exist for testing and demos
- release-quality test matrix spans browser, desktop, and mobile
- finishing-touch work is explicit rather than implied

## Definition of Done

- approved PRDs for desktop, iOS, and Android
- approved mock service catalog
- approved QA matrix and release checklist
- backlog exists for platform implementation after core backend stabilization
