# System Overview

## Objective

Describe the program-level architecture for the extension-first Identity Manager platform while this repo remains the planning anchor.

## Primary Components

### Browser Extension

- Chrome and Firefox support
- sign-up/login detection
- autofill engine
- popup quick actions
- full vault UI
- encrypted local cache
- sync client
- unlock/session manager

### Identity API

- accounts and auth
- device registration and approval
- encrypted sync
- domain profile and suggestion services
- artifact manifest service
- mock plan and entitlement services
- audit and risk events

### Database and Object Storage

- relational data for accounts, devices, metadata, manifests, and events
- object storage for encrypted blobs and generated encrypted artifacts

### `vaultwares-pipelines`

- policy-aware persona generation orchestration
- text/media workflow execution
- artifact packaging and callback delivery

### Companion Clients

- desktop app
- iOS app + Password AutoFill extension
- Android app + AutofillService

## Trust Boundaries

### Boundary A: User Device

- local unlock
- plaintext item editing
- decryption
- local secure cache

### Boundary B: Identity API

- ciphertext and metadata storage
- device orchestration
- job orchestration
- audit and risk event collection

### Boundary C: Pipelines

- controlled generation execution
- no permanent plaintext vault authority
- sealed artifact output only

## Core Data Flow

### Sign-Up Flow

1. extension detects sign-up page
2. user requests new fictional identity
3. extension calls API
4. API starts job in pipelines
5. pipelines returns sealed persona artifacts
6. extension stores accepted outputs locally and syncs encrypted records
7. domain profile link is updated

### Login Flow

1. extension detects login page
2. extension normalizes domain
3. API or local metadata returns linked credential suggestions
4. extension unlocks locally and fills selected items
5. usage metadata updates without exposing secrets

### Multi-Device Flow

1. new device requests enrollment
2. trusted device approves
3. API stores updated wrapped access material
4. new device syncs encrypted items and unlocks locally

## Current-to-Future Repo Ownership

### Current Repo

- extension code
- planning docs

### Future Repo Candidates

- API service repo
- desktop repo
- iOS repo
- Android repo

## High-Level Non-Goals

- no real payment provider integration in this phase
- no real telecom or network service integration in this phase
- no server-side decryption of vault contents
