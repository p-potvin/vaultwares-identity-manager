# Core User Journeys

## Journey 1: First Run and Account Creation

### User Goal

Understand what the product does, create an account, and establish a secure local unlock path.

### Flow

1. install extension or app
2. see a short privacy-first introduction
3. create account
4. set PIN for local unlock
5. generate and export recovery kit
6. land in the empty vault with guided next steps

### UX Requirements

- explain fictional identity boundary clearly
- explain local unlock vs cloud sync simply
- do not bury recovery kit behind advanced settings

## Journey 2: Sign-Up Detection and New Identity Offer

### User Goal

Encounter a sign-up page and decide whether to use a new fictional identity.

### Flow

1. extension detects likely sign-up form
2. user sees a high-confidence suggestion surface
3. user can:
   - generate new fictional identity
   - dismiss
   - open vault for manual choice
4. system fills appropriate fields
5. credential and domain link are saved

### UX Requirements

- suggestion must explain that the identity is fictional
- show confidence and what will be filled
- distinguish sign-up from login clearly

## Journey 3: Login Detection and Existing Identity Suggestion

### User Goal

Encounter a login page and use a previously linked identity/credential set for the domain.

### Flow

1. extension detects login page
2. extension normalizes domain
3. user sees top suggestions tied to the domain
4. user picks a credential set or opens vault
5. system fills login and TOTP if available

### UX Requirements

- show domain-linked context
- explain why a suggestion appeared
- avoid sign-up-style language in login states

## Journey 4: Vault Management

### User Goal

Browse, edit, review, and organize encrypted items across devices.

### Flow

1. unlock vault
2. browse item classes
3. inspect details
4. edit metadata or notes
5. manage files, TOTP, and domain links

### UX Requirements

- item classes must be easy to scan
- encrypted state and sync status must be visible
- bulk editing should come later, not in v1 shell planning

## Journey 5: Device Approval

### User Goal

Add a new browser/app/device safely without weakening security posture.

### Flow

1. new client requests enrollment
2. existing trusted device receives approval prompt
3. user approves or rejects
4. new device gets wrapped access material
5. audit record is stored

### UX Requirements

- make device identity obvious
- make trust decision feel serious
- include expiration and revocation states

## Journey 6: Recovery Kit Export and Recovery

### User Goal

Recover access when a device is lost or reset.

### Flow

1. export recovery kit during onboarding or later
2. lose trusted device
3. start recovery flow on new device
4. import recovery kit and complete verification
5. rotate trust and restore access

### UX Requirements

- recovery kit importance must be communicated early
- recovery flow should be linear and calm
- risk messaging should be clear without sounding catastrophic

## Journey 7: Generated Persona Review

### User Goal

Review a fictional identity bundle before using it broadly.

### Flow

1. request new fictional identity
2. wait for generated bundle
3. review name, alias email, address, profile story, username/password, and other artifacts
4. accept and store, or discard and regenerate

### UX Requirements

- make it obvious that personas are fictional
- keep discard/regenerate actions easy
- premium media placeholders should remain clearly marked as mock or future
