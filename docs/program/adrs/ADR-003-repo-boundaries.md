# ADR-003: Repo Boundaries and Program Anchor

## Status

Accepted

## Context

The workspace already operates as a polyrepo environment. `vaultwares-identity-manager` is currently the only repo directly tied to this product, but the full service requires extension, API, desktop, iOS, Android, design, and backend orchestration concerns that should not all live in one codebase forever.

## Decision

Use `vaultwares-identity-manager` as the temporary program anchor and planning home while keeping the long-term code architecture polyrepo.

### This Repo Owns

- browser extension code
- shared planning documents under `docs/program/`
- short-term program coordination

### Future Sibling Repos / Services Own

- API and database service
- desktop application
- iOS application and Password AutoFill extension
- Android application and AutofillService
- marketing website implementation

### Shared Upstream Dependencies

- `vault-themes` remains the theme/token source of truth
- `vaultwares-pipelines` becomes the shared AI orchestration platform

## Consequences

### Positive

- allows planning to begin now without blocking on repo creation
- avoids mixing native app, backend, and extension build systems in one repo prematurely
- keeps future extraction straightforward

### Tradeoffs

- documentation will temporarily describe work that spans future repos
- backlog items must be explicit about “current repo” vs “future repo” ownership

## Follow-Up

- structure all documents around clear ownership sections
- create sibling repos only after `EPIC-01` and `EPIC-02` stabilize the architecture
- move or copy relevant documents into future repos when code ownership becomes real
