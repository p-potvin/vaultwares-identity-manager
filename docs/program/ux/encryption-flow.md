# Encryption Flow

## Objective

Explain the encryption model in a way that implementation teams and designers can both use. This document is intentionally human-readable first.

## Principles

- users unlock locally
- the server stores ciphertext, not usable vault plaintext
- each device must be explicitly trusted
- recovery is possible only with user-controlled recovery material and approval flows

## User-Facing Model

### 1. Account Creation

- user creates an account
- user creates a local PIN
- client derives local unlock material from the PIN
- client generates device-bound keys

### 2. Recovery Kit Creation

- client creates recovery material
- user exports or stores the recovery kit securely
- product explains that losing both trusted devices and the recovery kit risks permanent loss of vault access

### 3. Vault Item Creation

- client creates or receives plaintext locally
- client encrypts the item into a versioned vault envelope
- envelope plus safe metadata sync to the API

### 4. Device Enrollment

- new device requests access
- existing device approves
- access material is wrapped for the new device
- new device can then sync and unlock locally

### 5. Generated Persona Delivery

- API requests persona generation from `vaultwares-pipelines`
- pipelines produce outputs
- outputs are sealed for the target user
- API stores encrypted artifacts and manifest metadata
- client fetches and decrypts locally

## Screens That Need This Model

- onboarding
- PIN setup
- lock screen
- device approval
- recovery kit export
- recovery kit import
- sync conflict resolution
- generated persona review

## UX Copy Constraints

- say “unlock locally” rather than “decrypt with derived secret” in user copy
- say “recovery kit” rather than “key backup bundle” in user copy
- never imply the backend can help decrypt user content
- make device approval and recovery feel trustworthy, not obscure

## Engineering Constraints

- envelope versioning must be explicit
- lock timeout rules must be configurable
- logs must not include plaintext vault data or recovery material
- callback flows from pipelines must be signed and auditable

## Diagram Requirements

Canva and future architecture diagrams should show:

1. client creates and unlocks locally
2. server stores encrypted items and metadata only
3. device approval path
4. recovery path
5. pipelines artifact sealing path

## Open Questions for Later Implementation

- exact recovery-kit composition
- exact device-rekey behavior after PIN change
- exact policy for lock-on-browser-close vs lock-on-idle
- exact item-level vs bundle-level key granularity
