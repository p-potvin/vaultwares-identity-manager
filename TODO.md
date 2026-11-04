# TODO

Crypto state, fixed security-review findings, and what is deliberately still
open: `docs/crypto-status.md`. It covers why multi-device key provisioning is
shelved (local-only sync has no shared server between devices — it needs a
tailnet-shared vault-warden) and why the device model must not be deleted.

Passkey design, decisions, and the list of WebAuthn features deliberately not
implemented yet (conditional mediation, hybrid transport, extensions):
`docs/passkeys.md`.

Form detection, what gets offered for autofill, and how the save prompt survives
a navigation: `docs/autofill.md`.

Mobile (PWA, iOS first) — read before starting that work:
`docs/handoff-pwa-ios.md`. It records why native iOS is ruled out, and the
blocker that production still runs the legacy vault-warden build without the
endpoints enrollment depends on.

Known gaps from the v2.1.0 work:

- The suggestion menu lists passkeys for awareness but cannot start a sign-in;
  only the site can begin a ceremony. Conditional mediation would fix this.
- Closing a tab before answering the save prompt discards the pending save.

The i18n retrofit is done for popup, onboarding, and the vault UI: every
user-facing string on those surfaces goes through `src/i18n/strings.ts` (EN +
QC). New strings must follow.

Backlog seeds and planning work now live in:

- `docs/program/backlog/github-issue-seeds.md`
- `docs/program/epics/`

Use the issue seed file to mirror planning work into GitHub once write tooling is available.
