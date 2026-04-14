# Data Contracts

## Objective

Define the shared entities that all future repos and services must align around.

## Core Shared Types

### User

- `user_id`
- `email`
- `account_state`
- `created_at`
- `updated_at`

Notes:

- auth fields and vault fields remain separate concerns
- user record never implies server-side vault decryption authority

### DeviceRegistration

- `device_id`
- `user_id`
- `device_name`
- `device_class`
- `platform`
- `public_key_bundle`
- `approval_state`
- `last_seen_at`

### VaultItem

- `item_id`
- `user_id`
- `item_type`
- `envelope_version`
- `ciphertext_ref`
- `metadata`
- `created_at`
- `updated_at`

Supported `item_type` targets for v1 planning:

- login
- address
- payment-card
- totp-secret
- secure-note
- secure-file
- fictional-persona
- persona-artifact-reference

### VaultItemVersion

- `item_version_id`
- `item_id`
- `version_number`
- `wrapped_item_key`
- `ciphertext_ref`
- `author_device_id`
- `created_at`

### DomainProfile

- `domain_profile_id`
- `normalized_domain`
- `display_domain`
- `cluster_key`
- `site_name`
- `login_signature`
- `signup_signature`
- `last_seen_at`

### DomainIdentityLink

- `domain_identity_link_id`
- `domain_profile_id`
- `vault_item_id`
- `link_type`
- `confidence_score`
- `last_used_at`

`link_type` examples:

- preferred-login
- prior-signup
- suggested-identity

### PersonaGenerationJob

- `job_id`
- `user_id`
- `request_profile`
- `job_status`
- `policy_state`
- `requested_artifact_types`
- `created_at`
- `completed_at`

### ArtifactManifest

- `manifest_id`
- `job_id`
- `user_id`
- `artifact_entries`
- `sealed_bundle_ref`
- `status`
- `created_at`

Each artifact entry should include:

- `artifact_type`
- `encrypted_blob_ref`
- `mime_type`
- `preview_metadata`
- `integrity_hash`

### MockSubscription

- `subscription_id`
- `user_id`
- `plan_code`
- `status`
- `starts_at`
- `ends_at`

### MockEntitlement

- `entitlement_id`
- `user_id`
- `feature_code`
- `status`
- `source_plan_code`
- `expires_at`

### AuditEvent

- `event_id`
- `correlation_id`
- `user_id`
- `device_id`
- `event_type`
- `event_scope`
- `occurred_at`
- `safe_metadata`

### RiskEvent

- `risk_event_id`
- `correlation_id`
- `user_id`
- `device_id`
- `risk_type`
- `severity`
- `safe_metadata`
- `occurred_at`

## Contract Rules

- all shared contracts must be versioned
- all IDs should be opaque and non-guessable
- encrypted item contracts must separate ciphertext from searchable metadata
- mock commerce contracts must remain implementation-neutral
- clients must tolerate additive fields

## Searchable Metadata Guidance

Allowed examples:

- item type
- display label
- domain profile references
- timestamps
- non-sensitive state flags

Disallowed examples:

- plaintext passwords
- plaintext notes
- plaintext TOTP secrets
- recovery material
- raw generated persona internals that should stay encrypted
