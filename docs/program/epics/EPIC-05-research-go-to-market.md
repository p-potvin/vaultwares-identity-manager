# EPIC-05: Research, Deferred Commercial Systems, Marketing, Website Revamp

## Goal

Research the future commercial, infrastructure, and growth layers of the product without implementing any high-cost or legally sensitive systems in the current phase.

## Explicit Constraint

This epic is research-only for:

- payment processing
- crypto settlement
- burner-number infrastructure
- IP address/network products
- pricing monetization execution

No implementation should start from this epic until the legal entity, budget, and provider strategy are ready.

## Outputs

- billing best-practices brief
- telecom/provider landscape brief
- IP/network offering brief
- pricing and packaging memo
- marketing/publicity strategy memo
- SEO/content plan
- `vaultwares-v1` redesign brief and IA proposal

## Workstreams

### 1. Billing Research

- compare self-managed and provider-mediated approaches
- identify legal/compliance dependencies
- define mock-to-real migration concerns
- document data boundaries between billing systems and encrypted vault systems

### 2. Phone Number Product Research

- survey number providers and portability constraints
- survey compliance, fraud, abuse, support, and geography constraints
- define what would make a future rollout viable or unviable

### 3. IP / Network Product Research

- research static vs dynamic IP offerings
- research operational and abuse-monitoring costs
- identify provisioning/support implications
- define future feasibility gates

### 4. Pricing and Packaging

- define future plan ladder ideas
- map low-cost vs high-cost features
- define when features should remain mock-only
- build a future packaging framework without committing to pricing implementation

### 5. Marketing and Publicity

- define positioning against privacy and password-manager competitors
- define top audience segments
- define messaging architecture
- define publicity, partnerships, and launch narrative options

### 6. SEO and Content

- define content clusters around privacy education, identity minimization, and secure account management
- identify target keywords and landing page opportunities
- define long-tail and education strategy

### 7. Website Revamp

- review `vaultwares-v1`
- define new information architecture
- define conversion funnels, landing-page narrative, and feature-page strategy
- define what assets and screenshots the future site needs from product UX work

## Suggested Backlog Seeds

- issue seed: billing best-practices research memo
- issue seed: phone-number provider landscape and feasibility memo
- issue seed: IP/network product feasibility memo
- issue seed: pricing and packaging framework memo
- issue seed: marketing and launch strategy memo
- issue seed: SEO/content plan
- issue seed: `vaultwares-v1` redesign brief and IA proposal

## Dependencies

- stable product boundary from ADR-001
- brand direction outcomes from `EPIC-01`
- mock entitlement shapes from `EPIC-02`

## Acceptance Criteria

- every topic ends in a concrete decision memo or open-question memo
- every memo includes a “not before” gate tied to corporation/funding readiness
- no implementation tickets are created for real payment or telecom systems in this phase
- website revamp brief is actionable for later design/execution

## Definition of Done

- all research briefs are authored
- each brief lists decision criteria, source types, and deferred implementation gates
- growth/commercial planning is decoupled from near-term product implementation
