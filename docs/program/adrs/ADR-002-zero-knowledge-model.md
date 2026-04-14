# ADR-002: Zero-Knowledge Client-First Trust Model

## Status

Accepted

## Context

VaultWares Identity Manager needs a security model that supports encrypted multi-device sync, AI-generated persona bundles, local unlock with a PIN, and API-backed storage without turning the backend into a privileged plaintext vault.

The current prototype stores plaintext vault records in browser local storage. That is not acceptable for the target product.

## Decision

Adopt a zero-knowledge client-first architecture:

- clients generate and hold device keys
- vault item plaintext is encrypted on the client before sync
- the API stores ciphertext, wrapped keys, item metadata, and audit events only
- the API can orchestrate generation jobs and artifact delivery, but generated persona bundles must be sealed for the user before long-term storage or sync
- user unlock uses a PIN-derived secret locally and never requires the backend to know vault plaintext

## Core Principles

- decryption lives on client devices only
- server-side search uses metadata and domain indexes, not plaintext vault fields
- recovery uses user-controlled recovery kit material and device approval flows
- AI output handling must end in encrypted artifacts addressed to a specific user account/device set

## Consequences

### Positive

- stronger privacy posture
- cleaner trust boundary for the API
- easier future positioning around secure vaulting

### Tradeoffs

- more complex onboarding and recovery flows
- more client-side crypto and sync complexity
- less server-side product analytics on user content

## Implementation Notes

- use explicit key hierarchy and envelope versioning
- define rekey and device-revoke behavior early
- avoid repeating weak patterns from existing plain PIN storage approaches in adjacent repos
- ensure audit and observability events never leak protected content

## Follow-Up

- define key hierarchy in `EPIC-03`
- define shared vault envelope contracts in `architecture/data-contracts.md`
- add a security verification section in `architecture/testing-strategy.md`
