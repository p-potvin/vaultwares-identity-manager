# Billing Best Practices Brief

## Objective

Research the safest and most practical way to introduce billing later without weakening the product’s zero-knowledge posture or overcommitting before the corporation and budget are ready.

## This Phase

Research only. No real payment implementation.

## Key Questions

- what billing data must remain separate from encrypted vault data?
- what should be self-managed vs delegated to a provider later?
- how should mock subscriptions and entitlements map to future real billing systems?
- what legal, tax, refund, fraud, and support obligations would activate at implementation time?

## Required Outputs

- billing architecture memo
- data-boundary memo between vault and billing systems
- migration plan from mock plans to real plans
- “not before” gate tied to corporation readiness and funding

## Source Types

- official payment platform docs
- accounting/tax guidance for the target jurisdictions
- competitor onboarding and billing behavior
- privacy and data-minimization best practices

## Deferred Implementation Gate

Do not implement real billing until:

- corporation is established
- banking and tax posture are defined
- refund and support policy are approved
- future provider strategy is chosen
