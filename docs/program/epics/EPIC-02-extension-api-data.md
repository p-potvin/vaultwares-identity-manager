# EPIC-02: Web Extension, Database, API

## Goal

Turn the current local-only browser extension prototype into the first client of a global encrypted identity platform backed by an API, database, and AI orchestration backend.

## Current State

The repo currently contains:

- a Manifest V3 extension bundle
- `src/background/background.ts` message routing
- `src/content/content.ts` and related detection/fill logic
- `src/popup/*` quick actions UI
- `src/vault/*` full vault UI
- local identity/password generation utilities
- local plaintext persistence in browser storage

This is a useful prototype, but not the target architecture.

## Outputs

- extension architecture PRD
- API surface specification
- database schema v1
- `vaultwares-pipelines` globalisation plan
- sync/offline strategy
- browser compatibility and packaging plan for Chrome and Firefox

## Target Architecture Split

### Extension

- domain detection engine
- signup/login intent classifier
- autofill engine
- vault UI surfaces
- unlock/session manager
- encrypted local cache
- sync client
- browser compatibility adapter

### API

- auth/accounts
- device registration and approval
- encrypted vault sync
- domain profile and suggestion APIs
- generation job orchestration
- artifact manifest service
- mock entitlements and plan catalog

### Database

- users
- devices
- device keys
- vault items
- item versions
- wrapped item keys
- domain profiles
- domain identity links
- generation jobs
- artifact manifests
- mock subscriptions / invoices / entitlements
- audit events and risk events

### Pipelines

- persona generation request intake
- text/media workflow orchestration
- policy gate
- artifact packaging
- callback signing and delivery

## Workstreams

### 1. Extension Architecture Rewrite

- replace local plaintext vault persistence with encrypted storage and sync-ready records
- move business logic out of the current monolithic message handlers
- define feature modules and shared contracts
- define offline queue and retry behavior

### 2. Cross-Browser Support

- identify Chrome-only APIs and Firefox-compatible alternatives
- define manifest and packaging deltas
- define browser-specific QA matrix
- document store submission constraints and required disclosures

### 3. API Surface Spec

- version routes under `/v1`
- define request/response contracts for auth, devices, vault, sync, domains, generation, artifacts, and mocks
- define metadata-only search contracts
- define capability negotiation for future desktop/mobile clients

### 4. Database Schema v1

- define canonical tables and indexes
- define versioning strategy for encrypted vault items
- define domain-link and suggestion data model
- define audit/risk event storage requirements

### 5. `vaultwares-pipelines` Expansion

- describe how `vaultwares-pipelines` evolves from a workflow platform into a shared generation backend
- define async job state machine
- define callback payloads and artifact manifests
- define what remains inside pipelines vs what moves into the identity API

### 6. Mock Commerce and Entitlements

- define plan catalog shapes
- define mock invoices/subscriptions/entitlements
- keep all integrations simulated
- ensure future commercialization can be layered without rewriting contracts

## Suggested Backlog Seeds

- issue seed: define extension module boundaries and sync responsibilities
- issue seed: draft Chrome/Firefox packaging compatibility matrix
- issue seed: define `/v1` API route groups and contract ownership
- issue seed: design encrypted vault schema and item versioning
- issue seed: design domain profile and identity suggestion model
- issue seed: define `vaultwares-pipelines` job/callback integration
- issue seed: define mock plan and entitlement schemas
- issue seed: define offline queue and sync reconciliation behavior

## Dependencies

- `EPIC-01` shell and trust-language outcomes
- ADR-002 zero-knowledge model
- ADR-003 repo boundaries
- `architecture/system-overview.md`
- `architecture/data-contracts.md`

## Acceptance Criteria

- extension responsibilities are clearly separated from API and pipelines responsibilities
- full API map and data-contract map are stable enough for parallel implementation
- database schema supports encrypted sync and domain-linked identity suggestions
- Chrome and Firefox delivery constraints are explicit
- mock plan/tier contracts exist without any real payment execution

## Definition of Done

- approved extension architecture PRD
- approved API and schema package
- approved pipelines globalisation plan
- approved sync/offline strategy
- implementation backlog split cleanly across extension, API, and pipelines lanes
