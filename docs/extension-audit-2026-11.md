# Extension UI/UX and performance audit — November 2026

Every screen was driven in Chromium (Playwright, MV3, extension loaded
unpacked) against a seeded vault of 200 logins, a card, a TOTP item and an
identity. Firefox was not available in the audit container; Firefox-specific
notes come from reading the code and manifest. Timings are from the same
headless Chromium before (`main` @ `ec57eff`) and after this branch.

## Fixed in this branch

### Broken on Chrome

| Issue | Cause | Fix |
|---|---|---|
| `npm run build` fails on `main` | Dependabot's "bump postcss-selector-parser" (09ed939) also bumped `tailwindcss` 3 → 4, whose PostCSS plugin moved to another package | Pinned back to `^3.4`. Migrating to v4 is its own change (class semantics differ) |
| Suggestion menu never opens on Chrome; popup shows no matches; save prompt never appears | `await import('../utils/domain')` in the background. Webpack loads async chunks with a `<script>` tag, and an MV3 service worker has no `document`: `GET_PAGE_MATCHES` failed with *document is not defined*, later calls (and `QUEUE_SAVE_PROMPT`) never answered. Firefox runs the background as an event page, which is why it worked there | Static imports in background and content scripts |
| In-page "generate password" (content script) | Same dynamic-import pattern; the chunk would load into the page's world | Static import |
| Auto-lock never fires on Chrome | Lock was a `setTimeout` in the service worker; Chrome evicts an idle worker after ~30s while the master key survives in `storage.session`, so the vault stayed unlocked until the browser closed | Persisted lock deadline checked on every key read (`keychain.ts`), refreshed by user activity |

### Security / correctness

- **Autofill typed the TOTP *secret* into the site's 2FA box** (popup autofill
  and in-page menu). Now the current code is generated.
- **Domain matching:** IPs collapsed to their last two octets (`192.168.1.1` ≡
  `10.0.1.1`), and shared-hosting siblings (`alice.github.io` /
  `attacker.github.io`, `*.vercel.app`, …) were "related", so a credential was
  offered on a stranger's site. IPs are now exact-only and a list of
  shared-hosting suffixes is treated as public suffixes. Tests added.
- **Duplicate save prompts:** the "is this login already saved?" check compared
  `metadata.domain` with the *registrable* domain, which never equals the full
  host the popup stores (`accounts.google.com` ≠ `google.com`), and only looked
  at `username`, not `email`.
- **Identity assignment never synced** (`ASSIGN_ITEM_TO_IDENTITY` /
  `UNASSIGN_…` wrote locally without enqueueing).
- **Delete is one click, permanent, and synced** (no trash). Now needs a second
  click within 4s.

### Performance

| Operation (200 items) | Before | After |
|---|---|---|
| `GET_ITEMS` (vault list) | 764 ms every call | 713 ms first call after unlock, ~30 ms after |
| `GET_PAGE_MATCHES` (every page with a login form) | error / hang (see above); would be ~800 ms | ~22 ms |
| `GET_PAGE_IDENTITIES` | hang; would decrypt the vault a second time | ~30 ms |
| `QUEUE_SAVE_PROMPT` | hang | ~20 ms |
| Popup item count | `GET_ITEMS`: whole vault decrypted and messaged for `.length` | `GET_ITEM_SUMMARY`: ~17 ms, no decryption |
| Popup, unlocked, first content | 396 ms + 3 requests to Google Fonts | ~105 ms, no remote requests |
| Vault ready | 1012 ms | ~120–170 ms |

Changes: a decrypted-item cache in the background keyed by item id and
envelope signature (a re-encrypted item always has a new signature, so sync and
edits invalidate it; cleared on lock), and removal of the render-blocking
Google Fonts `@import` (which also told Google every time the popup opened).

### Requested features

- Suggestion menu sorted by **last used, newest first** (the identity-first
  grouping that broke the order is gone; its group header was the item label's
  first word, not the identity's name — now an identity badge).
- **Type-to-filter** in the suggestion menu (username/email fields; never on
  password fields). Accent- and case-insensitive.
- **Sign-up suggestions:** on sign-up forms the email/username field offers the
  identifiers already used across the vault, ranked by how many logins use them.
- **Popup item details and editing:** click a row for a detail view (copy each
  field, reveal password, live 2FA code, last used), edit a login in place
  (title, email, username, password with generator, website, 2FA secret, notes).
  "New item for this site" now drops straight into the editor.
- **Popup search** across the whole vault (label, domain, tags, username, email, URL).
- **"Open Vault" from the popup filters to the current site** (`vault.html?search=<domain>`).
- Vault search now matches username, email and URL; vault list has a sort
  control (recently used / name / newest), favourites first.
- `browser_specific_settings.gecko.comment` removed from `manifest.json`.

### Layout

- In-page menu: title and subtitle ran together on one line and the "New" badge
  overlapped text (spans without `display:block`).
- Vault below ~800px: fixed 240px sidebar, search overlapping the heading,
  "New Item"/"Generate" pushed off-screen. Sidebar is now an icon rail below
  `md`, header rows wrap, search takes its own row on small widths.
- Popup: no bounded height, so a long list pushed the footer out of view; TOTP
  popover was `absolute` inside a non-positioned row; row actions were
  hover-only (unreachable by keyboard).

## Found, not fixed (recommended next)

1. **Unlock takes ~3 s** (Argon2id t=3, m=64 MiB in pure JS via
   `@noble/hashes`; measured 2.8–3.5 s). Auto-unlock tries at 4, 5 and 6 digits
   back to back, so a 6-digit PIN can mean ~9 s of hashing. A WASM Argon2
   (e.g. `hash-wasm`) is typically 5–10× faster at the same parameters.
2. **Saving is O(n) per item, O(n²) in bulk:** every create/update re-reads and
   rewrites the whole `vw_vault_items` array (~5 KB per item with ML-DSA
   signatures). `CREATE_ITEM` went from 40 ms to 165 ms between item 1 and 200;
   imports will crawl at a few thousand items. Store items under per-id keys.
3. **Every item re-encryption costs an ML-DSA-65 signature (~15 ms)**, including
   `UPDATE_ITEM_LAST_USED` on every autofill. Consider keeping `lastUsedAt`
   outside the signed envelope or batching it.
4. **Favicons are fetched from `google.com/s2/favicons`**, disclosing every
   vault domain to Google whenever a list renders. Proxy them or cache locally.
5. **Background accepts every message from any sender**, including content
   scripts running in every frame: `GET_ITEMS` (whole vault in plaintext),
   `DELETE_ITEM`, `RESET_DEVICE`, `SAVE_SETTINGS`. Check `sender.url` /
   `sender.tab` and only allow extension pages to call vault-wide operations.
6. **Public suffix handling** is still a hand-written list; ship the PSL.
7. **The proactive menu covers the password field** directly under a username
   field; clicking the password field selects a menu entry instead. Offset the
   menu or close it when focus moves.
8. `public/icons/source/vault-warden-nobg.png` (1.6 MB) is copied into the
   packaged extension.
9. Vault item avatars use `getInitials(label)`, which renders `G#` for
   "github.com #0"-style labels; prefer the favicon or the first letter of the host.
10. Popup/vault/onboarding copy is still English-only (known; `TODO.md`).

## Compared with Proton Pass (browser extension)

Based on Proton Pass's public feature set; worth re-checking against the
current release before planning.

| Proton Pass | VaultWares | Notes |
|---|---|---|
| Inline field icon to open the dropdown | — | Menu opens on focus only |
| Dropdown search / last-used order | ✅ (this branch) | |
| Hide-my-email aliases on sign-up | — | Sign-up identifier suggestions added instead; aliases need a server |
| Passkeys incl. autofill UI (conditional mediation) | Partial | Modal ceremonies only (`docs/passkeys.md`) |
| Auto-copy TOTP after autofill | — | Easy follow-up now that autofill generates codes |
| Full vault browsing, detail and edit in popup | ✅ logins (this branch) | Cards/notes/identities still open the vault |
| Secure notes, custom fields, attachments | — | No note item type; no custom fields |
| Multiple vaults, sharing, secure links | — | Single local vault |
| Trash / restore, item history | — | Deletes are permanent and synced |
| Password health (weak / reused / breached / missing 2FA) | — | Reused-password detection is cheap with the decrypted cache |
| Generator history | — | |
| Per-site autofill exclusions | — | Only global toggles in Settings |
| Toolbar badge with match count | — | Badge only flashes after a save |
| Keyboard shortcuts (`commands`) and context menu | — | |
| Cross-origin iframe autofill warning | — | Content script runs in all frames with no origin check before filling |
| Export | — | Import only |
| Sort / filter by type in lists | ✅ sort (this branch), type tabs | |
| Light theme | — | Console theme only |
