# EPIC-03: Encryption Implementation and Module Integration

## Goal

Specify the full cryptographic architecture and integration plan that safely connects the extension, API, and `vaultwares-pipelines` without exposing user vault plaintext to the backend.

## Outputs

- crypto ADR and hierarchy spec
- vault envelope format spec
- device enrollment and recovery spec
- pipeline artifact sealing flow
- signed callback verification flow
- rollout plan for extension/API/pipelines integration

## Scope

### Included

- client key hierarchy
- local PIN derivation and unlock behavior
- encrypted local cache and session expiry
- vault item envelopes and versioning
- recovery kit format and device recovery
- sealing generated artifacts before sync
- sync conflict resolution
- audit/risk event minimums

### Excluded

- implementation of every crypto primitive in this repo
- server-side plaintext search
- any trust model where the backend becomes the decryption authority

## Workstreams

### 1. Key Hierarchy

- define account root, device keys, item keys, and recovery material
- define key wrapping and rotation rules
- define how new devices are enrolled and trusted
- define how revoked devices lose access

### 2. PIN and Session Unlock

- define Argon2id or equivalent PIN derivation
- define unlock session lifetime and re-lock triggers
- define biometric-assisted unlock expectations for desktop/mobile
- define lock-screen copy and error states

### 3. Vault Envelope Format

- define envelope version field
- define ciphertext, nonce, wrapped key, metadata, and integrity fields
- define item classes for login, address, card, TOTP, note, file, and persona bundle parts
- define migration path for future envelope versions

### 4. Recovery and Rekey

- define recovery kit contents
- define recovery kit export/import UX assumptions
- define rekey triggers after password/PIN/device changes
- define lost-device recovery and trust reset rules

### 5. Pipelines Artifact Sealing

- define how generation results are encrypted for the target user/account/device set
- define artifact manifest shape and signed callback payload
- define server-side verification and storage responsibilities
- define what metadata remains searchable

### 6. Sync and Conflict Handling

- define optimistic local writes
- define pending sync queue
- define item version merge strategy
- define how conflicts surface to users

### 7. Security Observability

- define correlation ID expectations
- define audit and risk event categories
- define what can be logged and what must never be logged
- define key operational dashboards without sensitive leakage

## Suggested Backlog Seeds

- issue seed: define key hierarchy and wrapping model
- issue seed: define PIN/session unlock behavior for all clients
- issue seed: define vault envelope v1 format
- issue seed: define recovery kit export/import and rekey policy
- issue seed: define pipelines artifact sealing and callback verification
- issue seed: define encrypted sync merge/conflict strategy
- issue seed: define audit/risk event taxonomy

## Dependencies

- ADR-002 zero-knowledge model
- `EPIC-02` API/data boundaries
- `ux/encryption-flow.md`
- `architecture/data-contracts.md`
- `architecture/testing-strategy.md`

## Acceptance Criteria

- server cannot decrypt vault contents by design
- generated persona bundles arrive encrypted for the client
- extension/API/pipelines handshake is specified end-to-end
- recovery and device-revocation flows are concrete enough to implement
- logs and monitoring requirements are explicit and privacy-safe

## Definition of Done

- approved key hierarchy and envelope v1
- approved recovery and rekey model
- approved pipelines sealing + callback flow
- approved sync and conflict model
- implementation work can be split across client, API, and pipelines teams safely
