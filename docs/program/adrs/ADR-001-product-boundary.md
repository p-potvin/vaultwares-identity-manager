# ADR-001: Product Boundary for Fictional Persona Generation

## Status

Accepted

## Context

VaultWares Identity Manager will generate realistic identities for privacy-preserving consumer sign-ups. The user may describe broad preferences, but the product must not allow a user to recreate a real person, upload reference images for likeness matching, or request outputs intended for official identity fraud or KYC bypass.

This decision affects product copy, prompt design, model policies, moderation, research scope, billing scope, and backlog prioritization.

## Decision

The program will support:

- synthetic-only fictional personas
- broad user preference hints such as age range, vibe, region, or general profile style
- realistic but non-referential text attributes such as name, address pattern, alias email, background story, school/work/hobbies, and account profile details
- premium media outputs only when they remain fictional and do not attempt to emulate a known individual

The program will not support:

- reference-image cloning
- celebrity/public-figure lookalikes
- “make me look like” prompts
- real user likeness preservation
- passports, driver’s licenses, government IDs, or official document generation
- selfie videos or face-motion flows designed to bypass KYC or liveness checks
- impersonation workflows or abuse automation

## Operational Rules

- Prompt interfaces must be vague by design. Users can steer broadly, but cannot provide exact identity targets.
- All generation pipelines must pass a policy gate before execution.
- If a request appears to seek identity fraud, KYC bypass, or impersonation, the system should reject it and emit a risk event.
- Generated content must be labeled internally as fictional synthetic identity content.

## Consequences

### Positive

- keeps product intent aligned with consumer privacy rather than abuse
- narrows legal, moderation, and reputational risk
- allows clearer brand positioning

### Tradeoffs

- reduces user control over exact persona appearance
- requires policy enforcement in prompt UX and backend orchestration
- rules out some potentially marketable but high-risk features

## Follow-Up

- enforce this boundary in onboarding copy, settings copy, and premium feature descriptions
- encode the policy in `vaultwares-pipelines` generation request validation
- include this boundary in future legal/compliance review before premium media rollout
