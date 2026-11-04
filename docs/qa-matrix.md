# Cross-Platform QA Matrix

What must be verified on each client before a release, and what "verified" means.
Run the automated gates first (`npm test`), then the manual matrix.

## Clients

| Client | Surface | Repo location |
| ------ | ------- | ------------- |
| Browser extension | popup, vault UI, content script, background worker | `src/popup`, `src/vault`, `src/content`, `src/background` |
| Mobile PWA | unlock, search, copy, TOTP | `src/mobile` (served at `warden.vaultwares.ca`) |

Native iOS and Android are not planned — see `ROADMAP.md` Phase 3.

## Automated gates (every change)

- `npm run typecheck` — clean
- `npm run test:domain` — domain matching, 16/16
- `npm run test:import` — import/export parsers incl. Proton ZIP + passkey recovery, 40/40
- `npm run test:portability` — account key + enrollment round-trips, 36/36
- `npm run test:webauthn` — authenticator conformance incl. RP verification, 33/33
- `npm run build` and `npm run build:pwa` — compile clean

## Manual matrix

Legend: **[E]** extension only · **[P]** PWA only · **[X]** both · **[S]** needs two devices

| # | Scenario | Clients | Pass criteria |
| - | -------- | ------- | ------------- |
| 1 | Onboarding from scratch | E | Keychain created, recovery kit downloads, vault opens |
| 2 | PIN unlock / wrong PIN / auto-lock | X | Wrong PIN says so; lock timer matches settings |
| 3 | Master-password enrollment | E | Self-check passes; `enrolled` state shown |
| 4 | Bootstrap second device from master password | S | Phone/browser opens the same vault; wrong password changes nothing |
| 5 | Item CRUD + sync | S | Create on A appears on B within one sync interval; edits merge last-write-wins |
| 6 | Identity CRUD + sync | S | Persona created on A appears on B; delete on A removes it on B |
| 7 | Identity deletion tombstone | S | Deleted persona does not resurrect after a later sync |
| 8 | Offline queue | E | Create/edit offline, go online, queue drains, no duplicates |
| 9 | Proton import (.zip / .json / .csv) | E | Preview counts match; passkeys import and sign; duplicates unticked by default |
| 10 | CSV export round-trip | E | Export → import yields the same logins, TOTP secrets, favorites |
| 11 | Autofill on a standard login form | E | Username + password fill; lastUsedAt updates |
| 12 | Autofill on split 4-8 box OTP inputs | E | Each box gets one digit; focus lands on the last |
| 13 | TOTP live code | X | Popup clock and inline menu badge show the current code with countdown |
| 14 | Passkey creation ceremony | E | Consent prompt; credential stored; site accepts registration |
| 15 | Passkey assertion ceremony | E | Site accepts sign-in; Proton-imported passkey works on subdomain of stored rpId |
| 16 | Passkey fallback | E | Locked vault → unlock prompt; browser authenticator offered as alternative |
| 17 | Save-login prompt | E | New vs update wording; survives one navigation; tab close discards |
| 18 | Toolbar badge | E | Count matches page matches on activation and navigation; clears on lock |
| 19 | PWA unlock + search + copy | P | Copy clears on timer; offline shell opens |
| 20 | PWA identity envelopes ignored | P | Personas in the sync stream do not render as vault items |
| 21 | Firefox MV3 parity | E | Same scenarios 1-18 on Firefox 128+ |
| 22 | Locked-state UX | X | Locked vault shows unlock screen, never an empty list |
| 23 | Unreachable sync server | X | Clear error; local state intact; no silent data loss |
| 24 | Device reset / key rotation | E | Old items stop multiplying; new keychain opens new items |
| 25 | Recovery kit restore | E | Broken keychain unlocks but decrypts nothing; kit file + PIN restores; wrong PIN changes nothing; pre-break items readable and new items creatable after |

## Release gates

- All automated gates green on Chrome and Firefox.
- Scenarios 4, 5, 6, 7 verified against the production vault-warden (greencloud), not the mock.
- `npm run build` bumps the patch version and produces `release/vaultwares-identity-manager-v<version>.zip` (manifest at zip root) — the artifact uploaded to AMO / Chrome Web Store.
- Scenario 9 verified with a real Proton export.
- No new untranslated strings on retrofitted surfaces (`src/i18n/strings.ts`).
