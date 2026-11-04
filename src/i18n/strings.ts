/**
 * Bilingual strings (EN + Quebec French) for surfaces added alongside passkeys,
 * manual identities, and the in-page suggestion menu.
 *
 * The rest of the extension predates this module and is still English-only;
 * retrofitting it is tracked separately. Anything new goes through `t()`.
 *
 * QC copy runs 15-20% longer than EN, so every consumer must size from content
 * rather than assume the English width.
 */

export type Locale = 'en' | 'qc';

type StringTable = Record<string, { en: string; qc: string }>;

const STRINGS = {
    /* ------------------------------------------------ passkey consent flow */
    passkeyCreateTitle: {
        en: 'Create a passkey',
        qc: "Créer une clé d'accès",
    },
    passkeyGetTitle: {
        en: 'Sign in with a passkey',
        qc: "Se connecter avec une clé d'accès",
    },
    passkeyCreateBody: {
        en: 'VaultWares will generate a passkey for {rp} and store the private key in your encrypted vault.',
        qc: "VaultWares va générer une clé d'accès pour {rp} et conserver la clé privée dans votre coffre chiffré.",
    },
    passkeyGetBody: {
        en: 'Sign in to {rp} using a passkey stored in your vault.',
        qc: "Connectez-vous à {rp} avec une clé d'accès conservée dans votre coffre.",
    },
    passkeyApproveCreate: {
        en: 'Create passkey',
        qc: "Créer la clé d'accès",
    },
    passkeyApproveGet: {
        en: 'Sign in',
        qc: 'Se connecter',
    },
    passkeyUseBrowser: {
        en: 'Use browser or security key',
        qc: 'Utiliser le navigateur ou une clé de sécurité',
    },
    passkeyCancel: {
        en: 'Cancel',
        qc: 'Annuler',
    },
    passkeyLockedTitle: {
        en: 'Vault is locked',
        qc: 'Le coffre est verrouillé',
    },
    passkeyLockedBody: {
        en: 'Unlock VaultWares to use your passkeys. Your PIN is never entered on a web page.',
        qc: "Déverrouillez VaultWares pour utiliser vos clés d'accès. Votre NIP n'est jamais saisi dans une page web.",
    },
    passkeyOpenVault: {
        en: 'Open VaultWares',
        qc: 'Ouvrir VaultWares',
    },
    passkeyWaitingUnlock: {
        en: 'Waiting for unlock…',
        qc: 'En attente du déverrouillage…',
    },
    passkeyNoneForSite: {
        en: 'No passkey saved for this site',
        qc: "Aucune clé d'accès enregistrée pour ce site",
    },
    passkeyAccountLabel: {
        en: 'Account',
        qc: 'Compte',
    },
    passkeyChooseAccount: {
        en: 'Choose an account',
        qc: 'Choisissez un compte',
    },

    /* ------------------------------------------------ suggestion menu copy */
    menuLoginsHeader: {
        en: 'VaultWares — Logins',
        qc: 'VaultWares — Identifiants',
    },
    menuSignupHeader: {
        en: 'VaultWares — Sign up',
        qc: 'VaultWares — Inscription',
    },
    menuNoMatches: {
        en: 'No matching logins found',
        qc: 'Aucun identifiant correspondant',
    },
    menuCreateForSite: {
        en: 'Create new login for this site',
        qc: 'Créer un identifiant pour ce site',
    },
    menuLocked: {
        en: 'Vault is locked — open VaultWares to unlock',
        qc: 'Coffre verrouillé — ouvrez VaultWares pour déverrouiller',
    },
    menuPasskeyBadge: {
        en: 'Passkey',
        qc: "Clé d'accès",
    },
    menuIdentityFallback: {
        en: 'Identity',
        qc: 'Identité',
    },
    menuIdentitiesGroup: {
        en: 'Identities',
        qc: 'Identités',
    },
    menuLinkedBadge: {
        en: 'This site',
        qc: 'Ce site',
    },
    menuGeneratePassword: {
        en: 'Use a generated password',
        qc: 'Utiliser un mot de passe généré',
    },
    menuGeneratePasswordHint: {
        en: 'Fills every password field and copies it',
        qc: 'Remplit tous les champs et le copie',
    },
    menuGenerateBadge: {
        en: 'New',
        qc: 'Nouveau',
    },
    menuNoFilterMatches: {
        en: 'Nothing in your vault matches what you typed',
        qc: 'Rien dans votre coffre ne correspond à votre saisie',
    },
    menuSuggestEmailsGroup: {
        en: 'Your emails',
        qc: 'Vos courriels',
    },
    menuSuggestUsernamesGroup: {
        en: 'Your usernames',
        qc: "Vos noms d'utilisateur",
    },
    menuSuggestUsedCount: {
        en: 'Used for {count} logins',
        qc: 'Utilisé pour {count} identifiants',
    },
    menuSuggestUsedOnce: {
        en: 'Used for 1 login',
        qc: 'Utilisé pour 1 identifiant',
    },

    /* --------------------------------------------------- save-login prompt */
    savePromptTitle: {
        en: 'Save this login to VaultWares?',
        qc: 'Enregistrer cet identifiant dans VaultWares?',
    },
    savePromptSave: {
        en: 'Save',
        qc: 'Enregistrer',
    },
    savePromptUpdate: {
        en: 'Update',
        qc: 'Mettre à jour',
    },
    savePromptDismiss: {
        en: 'Not now',
        qc: 'Pas maintenant',
    },
    savePromptUpdateTitle: {
        en: 'Update the saved password?',
        qc: 'Mettre à jour le mot de passe enregistré?',
    },

    /* ------------------------------------------------- manual identity form */
    identityCreateManual: {
        en: 'Create manually',
        qc: 'Créer manuellement',
    },
    identityNewTitle: {
        en: 'New identity',
        qc: 'Nouvelle identité',
    },
    identityEditTitle: {
        en: 'Edit identity',
        qc: "Modifier l'identité",
    },
    identityReviewTitle: {
        en: 'Review generated identity',
        qc: "Réviser l'identité générée",
    },
    identityNameRequired: {
        en: 'A full name is required',
        qc: 'Un nom complet est requis',
    },
    identitySave: {
        en: 'Save identity',
        qc: "Enregistrer l'identité",
    },
    identityFillSample: {
        en: 'Fill sample values',
        qc: 'Remplir avec des exemples',
    },

    /* ------------------------------------------------------------- popup */
    popupWelcomeTitle: {
        en: 'Welcome to VaultWares',
        qc: 'Bienvenue dans VaultWares',
    },
    popupWelcomeBody: {
        en: 'Set up your encrypted vault to get started.',
        qc: 'Configurez votre coffre chiffré pour commencer.',
    },
    popupStartSetup: {
        en: 'Start Setup',
        qc: 'Commencer la configuration',
    },
    popupUnlockTitle: {
        en: 'Unlock Vault',
        qc: 'Déverrouiller le coffre',
    },
    popupUnlockSubtitle: {
        en: 'Enter PIN to decrypt locally',
        qc: 'Saisissez le NIP pour déchiffrer localement',
    },
    popupUnlockAction: {
        en: 'Unlock',
        qc: 'Déverrouiller',
    },
    popupDeriving: {
        en: 'Deriving key…',
        qc: 'Dérivation de la clé…',
    },
    popupUnlockFailed: {
        en: 'Unlock failed',
        qc: 'Échec du déverrouillage',
    },
    popupOpenVaultTitle: {
        en: 'Open full vault',
        qc: 'Ouvrir le coffre complet',
    },
    popupOpenVault: {
        en: 'Open Vault',
        qc: 'Ouvrir le coffre',
    },
    popupMatchesFor: {
        en: 'Matches for {domain}',
        qc: 'Correspondances pour {domain}',
    },
    popupNoItemsForSite: {
        en: 'No items for this site.',
        qc: 'Aucun élément pour ce site.',
    },
    popupQuickPassword: {
        en: 'Quick Password',
        qc: 'Mot de passe rapide',
    },
    popupHide: {
        en: 'hide',
        qc: 'masquer',
    },
    popupGenerateQuickPassword: {
        en: 'Generate Quick Password',
        qc: 'Générer un mot de passe rapide',
    },
    popupItemsStat: {
        en: 'Items',
        qc: 'Éléments',
    },
    popupMatchesStat: {
        en: 'Matches',
        qc: 'Correspondances',
    },
    popupLock: {
        en: 'Lock',
        qc: 'Verrouiller',
    },
    popupSaved: {
        en: 'Saved!',
        qc: 'Enregistré!',
    },
    popupNewItemForSite: {
        en: 'New Item for this site',
        qc: 'Nouvel élément pour ce site',
    },
    popupCopyUsername: {
        en: 'Copy username',
        qc: "Copier le nom d'utilisateur",
    },
    popupCopyPassword: {
        en: 'Copy password',
        qc: 'Copier le mot de passe',
    },
    popupAutofill: {
        en: 'Autofill',
        qc: 'Remplissage auto',
    },
    popupShowTotp: {
        en: 'Show 2FA code',
        qc: 'Afficher le code 2FA',
    },
    popupOpenInVault: {
        en: 'Open in vault',
        qc: 'Ouvrir dans le coffre',
    },
    popupSearchPlaceholder: {
        en: 'Search the vault…',
        qc: 'Rechercher dans le coffre…',
    },
    popupResultsFor: {
        en: 'Results for “{query}”',
        qc: 'Résultats pour « {query} »',
    },
    popupNothingMatches: {
        en: 'Nothing matches.',
        qc: 'Aucun résultat.',
    },
    popupMoreInVault: {
        en: '{count} more in the vault…',
        qc: '{count} de plus dans le coffre…',
    },
    popupOpenVaultFiltered: {
        en: 'Open the vault filtered to {domain}',
        qc: 'Ouvrir le coffre filtré sur {domain}',
    },
    popupShowDetails: {
        en: 'Show details',
        qc: 'Afficher les détails',
    },
    popupCopyCode: {
        en: 'Copy code',
        qc: 'Copier le code',
    },
    popupRegenerate: {
        en: 'Regenerate',
        qc: 'Régénérer',
    },
    popupGeneratedPassword: {
        en: 'Generated password',
        qc: 'Mot de passe généré',
    },
    popupNewLogin: {
        en: 'New login',
        qc: 'Nouvel identifiant',
    },
    popupEditLogin: {
        en: 'Edit login',
        qc: 'Modifier l’identifiant',
    },
    popupLastUsed: {
        en: 'Last used {date}',
        qc: 'Dernière utilisation : {date}',
    },
    popupNeverUsed: {
        en: 'Never used',
        qc: 'Jamais utilisé',
    },
    popupCopyField: {
        en: 'Copy {field}',
        qc: 'Copier : {field}',
    },
    popupShowPassword: {
        en: 'Show password',
        qc: 'Afficher le mot de passe',
    },
    popupHidePassword: {
        en: 'Hide password',
        qc: 'Masquer le mot de passe',
    },
    popupTotpCode: {
        en: '2FA code · {seconds}s',
        qc: 'Code 2FA · {seconds} s',
    },
    popupEditedInVault: {
        en: 'This item type is edited in the vault.',
        qc: 'Ce type d’élément se modifie dans le coffre.',
    },
    popupNothingSelected: {
        en: 'Nothing selected',
        qc: 'Aucun élément sélectionné',
    },
    popupCouldNotSave: {
        en: 'Could not save',
        qc: 'Enregistrement impossible',
    },
    popupTitleField: {
        en: 'Title',
        qc: 'Titre',
    },
    popupWebsiteField: {
        en: 'Website',
        qc: 'Site web',
    },
    popupTotpField: {
        en: '2FA secret',
        qc: 'Secret 2FA',
    },
    popupTotpPlaceholder: {
        en: 'Base32 secret',
        qc: 'Secret Base32',
    },
    popupPasskeyBadge: {
        en: 'Passkey',
        qc: 'Clé d’accès',
    },
    vaultSortItems: {
        en: 'Sort items',
        qc: 'Trier les éléments',
    },
    vaultSortRecent: {
        en: 'Recently used',
        qc: 'Utilisés récemment',
    },
    vaultSortName: {
        en: 'Name A–Z',
        qc: 'Nom A–Z',
    },
    vaultSortNewest: {
        en: 'Newest',
        qc: 'Plus récents',
    },
    vaultDeleteConfirm: {
        en: 'Click again to delete permanently',
        qc: 'Cliquez de nouveau pour supprimer définitivement',
    },

    /* -------------------------------------------------- password strength */
    strengthVeryWeak: {
        en: 'Very Weak',
        qc: 'Très faible',
    },
    strengthWeak: {
        en: 'Weak',
        qc: 'Faible',
    },
    strengthFair: {
        en: 'Fair',
        qc: 'Passable',
    },
    strengthStrong: {
        en: 'Strong',
        qc: 'Solide',
    },
    strengthVeryStrong: {
        en: 'Very Strong',
        qc: 'Très solide',
    },

    /* --------------------------------------------------------- onboarding */
    onboardSubtitle: {
        en: 'Identity Manager Setup',
        qc: 'Configuration du gestionnaire d’identité',
    },
    onboardWelcomeTitle: {
        en: 'Welcome to your zero-knowledge vault',
        qc: 'Bienvenue dans votre coffre à connaissance nulle',
    },
    onboardWelcomeBody: {
        en: 'VaultWares uses post-quantum cryptography (ML-KEM-768, ML-DSA-65) to protect your data. Your vault is encrypted on this device and syncs only to VaultWarden running on your own machine — nothing is ever sent to us in a form we could read.',
        qc: 'VaultWares utilise la cryptographie post-quantique (ML-KEM-768, ML-DSA-65) pour protéger vos données. Votre coffre est chiffré sur cet appareil et ne se synchronise qu’avec VaultWarden sur votre propre machine — rien ne nous est envoyé sous une forme lisible.',
    },
    onboardFeatureItems: {
        en: 'Passwords, addresses, cards, TOTP, and passkeys',
        qc: 'Mots de passe, adresses, cartes, TOTP et clés d’accès',
    },
    onboardFeatureSync: {
        en: 'Encrypted sync to VaultWarden on this machine',
        qc: 'Synchronisation chiffrée vers VaultWarden sur cette machine',
    },
    onboardFeaturePqc: {
        en: 'Post-quantum cryptography (NIST standardized)',
        qc: 'Cryptographie post-quantique (normalisée par le NIST)',
    },
    onboardGetStarted: {
        en: 'Get Started',
        qc: 'Commencer',
    },
    onboardAccountTitle: {
        en: 'Create your account',
        qc: 'Créer votre compte',
    },
    onboardAccountBody: {
        en: 'This email identifies your account. Your vault data stays encrypted.',
        qc: 'Ce courriel identifie votre compte. Vos données restent chiffrées.',
    },
    onboardEmailLabel: {
        en: 'Email',
        qc: 'Courriel',
    },
    onboardEmailInvalid: {
        en: 'Please enter a valid email address',
        qc: 'Veuillez saisir une adresse courriel valide',
    },
    onboardContinue: {
        en: 'Continue',
        qc: 'Continuer',
    },
    onboardPinTitle: {
        en: 'Set your unlock PIN',
        qc: 'Définir votre NIP de déverrouillage',
    },
    onboardPinBody: {
        en: 'This PIN decrypts your vault locally. Choose something memorable — there is no recovery without your kit.',
        qc: 'Ce NIP déchiffre votre coffre localement. Choisissez-en un mémorable — sans votre trousse, aucun recouvrement n’est possible.',
    },
    onboardPinLabel: {
        en: 'PIN',
        qc: 'NIP',
    },
    onboardPinConfirmLabel: {
        en: 'Confirm PIN',
        qc: 'Confirmer le NIP',
    },
    onboardPinTooShort: {
        en: 'PIN must be at least 4 digits',
        qc: 'Le NIP doit compter au moins 4 chiffres',
    },
    onboardPinMismatch: {
        en: 'PINs do not match',
        qc: 'Les NIP ne correspondent pas',
    },
    onboardGeneratingKeys: {
        en: 'Generating keys…',
        qc: 'Génération des clés…',
    },
    onboardCreateVault: {
        en: 'Create Vault',
        qc: 'Créer le coffre',
    },
    onboardSetupFailed: {
        en: 'Setup failed',
        qc: 'Échec de la configuration',
    },
    onboardRecoveryTitle: {
        en: 'Save your recovery kit',
        qc: 'Conservez votre trousse de récupération',
    },
    onboardRecoveryBody: {
        en: 'If you lose this device or forget your PIN, the recovery kit is the only way to regain access to your vault. Store it somewhere safe — we cannot recover it for you.',
        qc: 'Si vous perdez cet appareil ou oubliez votre NIP, la trousse de récupération est le seul moyen de retrouver l’accès à votre coffre. Conservez-la en lieu sûr — nous ne pouvons pas la récupérer pour vous.',
    },
    onboardRecoveryWarning: {
        en: 'Without your recovery kit, losing your device means permanent loss of vault access.',
        qc: 'Sans votre trousse de récupération, la perte de votre appareil signifie la perte permanente de l’accès au coffre.',
    },
    onboardGenerateKit: {
        en: 'Generate Recovery Kit',
        qc: 'Générer la trousse de récupération',
    },
    onboardKitFailed: {
        en: 'Failed to generate recovery kit',
        qc: 'Impossible de générer la trousse de récupération',
    },
    onboardDownloadAgain: {
        en: 'Downloaded — Download Again',
        qc: 'Téléchargée — Télécharger à nouveau',
    },
    onboardDownloadKit: {
        en: 'Download Recovery Kit',
        qc: 'Télécharger la trousse de récupération',
    },
    onboardOpenVault: {
        en: 'Open My Vault',
        qc: 'Ouvrir mon coffre',
    },

    /* ------------------------------------------------------ shared actions */
    actionUnlock: {
        en: 'Unlock',
        qc: 'Déverrouiller',
    },
    actionCancel: {
        en: 'Cancel',
        qc: 'Annuler',
    },
    actionSave: {
        en: 'Save',
        qc: 'Enregistrer',
    },
    actionSaved: {
        en: 'Saved',
        qc: 'Enregistré',
    },
    actionDelete: {
        en: 'Delete',
        qc: 'Supprimer',
    },
    actionEdit: {
        en: 'Edit',
        qc: 'Modifier',
    },
    actionGenerate: {
        en: 'Generate',
        qc: 'Générer',
    },
    actionBack: {
        en: 'Back',
        qc: 'Retour',
    },
    actionDiscard: {
        en: 'Discard',
        qc: 'Abandonner',
    },
    actionStartSetup: {
        en: 'Start Setup',
        qc: 'Commencer la configuration',
    },
    actionSearch: {
        en: 'Search…',
        qc: 'Rechercher…',
    },

    /* ----------------------------------------------------------- vault nav */
    vaultIdentityVault: {
        en: 'Identity Vault',
        qc: 'Coffre d’identité',
    },
    vaultNavVault: {
        en: 'Vault',
        qc: 'Coffre',
    },
    vaultNavLogins: {
        en: 'Logins',
        qc: 'Identifiants',
    },
    vaultNavAddresses: {
        en: 'Addresses',
        qc: 'Adresses',
    },
    vaultNavCards: {
        en: 'Cards',
        qc: 'Cartes',
    },
    vaultNavPasskeys: {
        en: 'Passkeys',
        qc: 'Clés d’accès',
    },
    vaultNavGenerator: {
        en: 'Generator',
        qc: 'Générateur',
    },
    vaultNavDevices: {
        en: 'Devices',
        qc: 'Appareils',
    },
    vaultNavSettings: {
        en: 'Settings',
        qc: 'Paramètres',
    },
    vaultSync: {
        en: 'Sync',
        qc: 'Synchroniser',
    },
    vaultLockVault: {
        en: 'Lock Vault',
        qc: 'Verrouiller le coffre',
    },

    /* ------------------------------------------------------ vault screens */
    vaultNotSetUp: {
        en: 'Vault Not Set Up',
        qc: 'Coffre non configuré',
    },
    vaultNotSetUpBody: {
        en: 'Complete the onboarding to create your encrypted vault.',
        qc: 'Terminez l’initialisation pour créer votre coffre chiffré.',
    },
    vaultUnlockTitle: {
        en: 'Unlock Vault',
        qc: 'Déverrouiller le coffre',
    },
    vaultUnlockSubtitle: {
        en: 'Enter your PIN to decrypt locally',
        qc: 'Saisissez votre NIP pour déchiffrer localement',
    },
    vaultDecrypting: {
        en: 'Decrypting vault…',
        qc: 'Déchiffrement du coffre…',
    },
    vaultSyncing: {
        en: 'Syncing…',
        qc: 'Synchronisation…',
    },
    vaultSyncFailed: {
        en: 'Sync failed',
        qc: 'Échec de synchronisation',
    },
    vaultSyncedAt: {
        en: 'Synced {time}',
        qc: 'Synchronisé {time}',
    },
    vaultNotSyncedYet: {
        en: 'Not synced yet',
        qc: 'Pas encore synchronisé',
    },
    vaultJustNow: {
        en: 'just now',
        qc: 'à l’instant',
    },
    vaultMinutesAgo: {
        en: '{n}m ago',
        qc: 'il y a {n} min',
    },
    vaultHoursAgo: {
        en: '{n}h ago',
        qc: 'il y a {n} h',
    },
    vaultDaysAgo: {
        en: '{n}d ago',
        qc: 'il y a {n} j',
    },
    vaultItemsAndIdentities: {
        en: 'Items and identities',
        qc: 'Éléments et identités',
    },
    vaultIdentitiesTitle: {
        en: 'Identities',
        qc: 'Identités',
    },
    vaultOneIdentity: {
        en: '{n} identity',
        qc: '{n} identité',
    },
    vaultManyIdentities: {
        en: '{n} identities',
        qc: '{n} identités',
    },
    vaultSearchIdentities: {
        en: 'Search identities…',
        qc: 'Rechercher des identités…',
    },
    vaultRequiresEndpoint: {
        en: 'Requires a generation endpoint in Settings',
        qc: 'Nécessite un point de génération dans les paramètres',
    },
    vaultNoIdentitiesYet: {
        en: 'No identities yet. Create one by hand, or generate one if you have an endpoint configured.',
        qc: 'Aucune identité pour l’instant. Créez-en une à la main, ou générez-en une si un point de génération est configuré.',
    },
    vaultGenerationUnavailable: {
        en: 'Generation is unavailable — fill the identity in manually.',
        qc: 'La génération est indisponible — remplissez l’identité à la main.',
    },
    vaultCouldNotSaveIdentity: {
        en: 'Could not save the identity',
        qc: 'Impossible d’enregistrer l’identité',
    },
    vaultAllItems: {
        en: 'All Items',
        qc: 'Tous les éléments',
    },
    vaultOneItem: {
        en: '{n} item',
        qc: '{n} élément',
    },
    vaultManyItems: {
        en: '{n} items',
        qc: '{n} éléments',
    },
    vaultNewItem: {
        en: 'New Item',
        qc: 'Nouvel élément',
    },
    vaultNoItemsYet: {
        en: 'No items yet. Create your first vault item.',
        qc: 'Aucun élément pour l’instant. Créez votre premier élément.',
    },
    vaultShowCode: {
        en: 'Show code',
        qc: 'Afficher le code',
    },

    /* -------------------------------------------------------- item editor */
    vaultEditItem: {
        en: 'Edit {type}',
        qc: 'Modifier : {type}',
    },
    vaultNewItemOfType: {
        en: 'New {type}',
        qc: 'Nouvel élément : {type}',
    },
    fieldLabel: {
        en: 'Label',
        qc: 'Libellé',
    },
    fieldUrl: {
        en: 'URL',
        qc: 'URL',
    },
    fieldEmail: {
        en: 'Email',
        qc: 'Courriel',
    },
    fieldUsername: {
        en: 'Username',
        qc: 'Nom d’utilisateur',
    },
    addUsername: {
        en: '+ username',
        qc: '+ nom d’utilisateur',
    },
    fieldPassword: {
        en: 'Password',
        qc: 'Mot de passe',
    },
    fieldTotpSecret: {
        en: 'TOTP Secret (optional)',
        qc: 'Secret TOTP (facultatif)',
    },
    totpSecretPlaceholder: {
        en: 'Base32 secret',
        qc: 'Secret Base32',
    },
    fieldNotes: {
        en: 'Notes',
        qc: 'Notes',
    },
    fieldFullName: {
        en: 'Full Name',
        qc: 'Nom complet',
    },
    fieldStreet: {
        en: 'Street',
        qc: 'Rue',
    },
    fieldCity: {
        en: 'City',
        qc: 'Ville',
    },
    fieldStateProvince: {
        en: 'State/Province',
        qc: 'Province/État',
    },
    fieldZip: {
        en: 'ZIP/Postal Code',
        qc: 'Code postal',
    },
    fieldCountry: {
        en: 'Country',
        qc: 'Pays',
    },
    fieldPhoneOptional: {
        en: 'Phone (optional)',
        qc: 'Téléphone (facultatif)',
    },
    fieldCardholder: {
        en: 'Cardholder Name',
        qc: 'Nom du titulaire',
    },
    fieldCardNumber: {
        en: 'Card Number',
        qc: 'Numéro de carte',
    },
    fieldMonth: {
        en: 'Month',
        qc: 'Mois',
    },
    fieldYear: {
        en: 'Year',
        qc: 'Année',
    },
    fieldCvv: {
        en: 'CVV',
        qc: 'CVV',
    },
    fieldIssuerOptional: {
        en: 'Issuer (optional)',
        qc: 'Émetteur (facultatif)',
    },
    fieldSecretBase32: {
        en: 'Secret (Base32)',
        qc: 'Secret (Base32)',
    },
    fieldDigits: {
        en: 'Digits',
        qc: 'Chiffres',
    },
    fieldPeriod: {
        en: 'Period',
        qc: 'Période',
    },
    fieldAlgorithm: {
        en: 'Algorithm',
        qc: 'Algorithme',
    },
    vaultPasskeyCreatedBy: {
        en: 'Created by VaultWares',
        qc: 'Créée par VaultWares',
    },
    vaultPasskeyCreatedOn: {
        en: ' on {date}',
        qc: ' le {date}',
    },
    vaultPasskeyImported: {
        en: 'Imported passkey.',
        qc: 'Clé d’accès importée.',
    },
    vaultPasskeyReadOnly: {
        en: 'Key material is read-only. To replace it, delete this passkey and register a new one on the site.',
        qc: 'Le matériel de clé est en lecture seule. Pour le remplacer, supprimez cette clé d’accès et enregistrez-en une nouvelle sur le site.',
    },
    fieldRelyingParty: {
        en: 'Relying Party',
        qc: 'Partie prenante',
    },
    fieldRelyingPartyId: {
        en: 'Relying Party ID',
        qc: 'ID de partie prenante',
    },
    fieldCredentialId: {
        en: 'Credential ID',
        qc: 'ID d’identifiant',
    },
    fieldFavorite: {
        en: 'Favorite',
        qc: 'Favori',
    },

    /* ----------------------------------------------------------- generator */
    vaultGeneratorTitle: {
        en: 'Password Generator',
        qc: 'Générateur de mots de passe',
    },
    vaultGeneratorSubtitle: {
        en: 'Generate cryptographically secure passwords',
        qc: 'Générez des mots de passe cryptographiquement sûrs',
    },
    fieldPreset: {
        en: 'Preset',
        qc: 'Préréglage',
    },
    genLength: {
        en: 'Length: {n}',
        qc: 'Longueur : {n}',
    },
    genUppercase: {
        en: 'Uppercase (A-Z)',
        qc: 'Majuscules (A-Z)',
    },
    genLowercase: {
        en: 'Lowercase (a-z)',
        qc: 'Minuscules (a-z)',
    },
    genNumbers: {
        en: 'Numbers (0-9)',
        qc: 'Chiffres (0-9)',
    },
    genSymbols: {
        en: 'Symbols (!@#)',
        qc: 'Symboles (!@#)',
    },
    genStandardOnly: {
        en: 'Standard symbols only (!@#$%^&*()-_=+)',
        qc: 'Symboles standard seulement (!@#$%^&*()-_=+)',
    },
    genWordCount: {
        en: 'Word count: {n}',
        qc: 'Nombre de mots : {n}',
    },
    genDelimiter: {
        en: 'Delimiter',
        qc: 'Séparateur',
    },
    genSuffixType: {
        en: 'Suffix type',
        qc: 'Type de suffixe',
    },
    genSuffixNone: {
        en: 'None',
        qc: 'Aucun',
    },
    genSuffixNumeric: {
        en: 'Numeric',
        qc: 'Numérique',
    },
    genSuffixAlphanumeric: {
        en: 'Alphanumeric',
        qc: 'Alphanumérique',
    },
    genSuffixLength: {
        en: 'Suffix length: {n}',
        qc: 'Longueur du suffixe : {n}',
    },
    genCapitalize: {
        en: 'Capitalize first letter of each word',
        qc: 'Majuscule à la première lettre de chaque mot',
    },
    genTokenInfo: {
        en: 'Generates a JWT-like token with three base64url segments separated by dots. No configuration needed.',
        qc: 'Génère un jeton de type JWT avec trois segments base64url séparés par des points. Aucune configuration requise.',
    },

    /* ------------------------------------------------------ type selector */
    vaultNewItemType: {
        en: 'New Item Type',
        qc: 'Type de nouvel élément',
    },
    typeLogin: {
        en: 'Login',
        qc: 'Identifiant',
    },
    typeAddress: {
        en: 'Address',
        qc: 'Adresse',
    },
    typeCard: {
        en: 'Card',
        qc: 'Carte',
    },
    typeTotp: {
        en: 'TOTP',
        qc: 'TOTP',
    },
    typePasskey: {
        en: 'Passkey',
        qc: 'Clé d’accès',
    },
    typeLoginDesc: {
        en: 'Username, password, URL',
        qc: 'Nom d’utilisateur, mot de passe, URL',
    },
    typeAddressDesc: {
        en: 'Full postal address',
        qc: 'Adresse postale complète',
    },
    typeCardDesc: {
        en: 'Credit/debit card details',
        qc: 'Détails de la carte de crédit/débit',
    },
    typeTotpDesc: {
        en: 'Authenticator secret',
        qc: 'Secret d’authentificateur',
    },

    /* ------------------------------------------------------------ settings */
    fieldAutoLock: {
        en: 'Auto-lock (minutes)',
        qc: 'Verrouillage auto (minutes)',
    },
    fieldDefaultPwLength: {
        en: 'Default password length',
        qc: 'Longueur de mot de passe par défaut',
    },
    fieldDefaultComplexity: {
        en: 'Default complexity',
        qc: 'Complexité par défaut',
    },
    complexityMedium: {
        en: 'Medium',
        qc: 'Moyenne',
    },
    complexityHigh: {
        en: 'High',
        qc: 'Élevée',
    },
    complexityMaximum: {
        en: 'Maximum',
        qc: 'Maximale',
    },
    fieldDefaultPreset: {
        en: 'Default generator preset',
        qc: 'Préréglage du générateur par défaut',
    },
    settingAutoFill: {
        en: 'Auto-fill forms',
        qc: 'Remplir automatiquement les formulaires',
    },
    settingAutoDetect: {
        en: 'Auto-detect login/signup forms',
        qc: 'Détecter automatiquement les formulaires',
    },
    settingSavePrompt: {
        en: 'Offer to save logins after sign-in',
        qc: 'Proposer d’enregistrer les identifiants après connexion',
    },
    settingPasskeys: {
        en: 'Handle passkeys in VaultWares',
        qc: 'Gérer les clés d’accès dans VaultWares',
    },
    settingPasskeysHint: {
        en: 'Off hands every passkey prompt to your browser or security key instead.',
        qc: 'Désactivé, chaque demande de clé d’accès est confiée à votre navigateur ou à votre clé de sécurité.',
    },
    vaultSaveSettings: {
        en: 'Save Settings',
        qc: 'Enregistrer les paramètres',
    },
    vaultResetTitle: {
        en: 'Reset this device',
        qc: 'Réinitialiser cet appareil',
    },
    vaultResetBody: {
        en: 'Destroys the account keys and every item stored here, then starts onboarding fresh with a new keypair. This is how you rotate keys after a recovery kit leaks — items are sealed to the old key, so there is no way to keep them.',
        qc: 'Détruit les clés du compte et chaque élément stocké ici, puis recommence l’initialisation avec une nouvelle paire de clés. C’est ainsi qu’on renouvelle les clés après une fuite de trousse — les éléments sont scellés à l’ancienne clé, impossible de les conserver.',
    },
    vaultResetServerNote: {
        en: 'Items already synced to vault-warden are left alone and will be unreadable afterwards. Delete them there first if you want them gone.',
        qc: 'Les éléments déjà synchronisés vers vault-warden sont laissés tels quels et deviendront illisibles. Supprimez-les d’abord là-bas si vous voulez les effacer.',
    },
    vaultResetTypeConfirm: {
        en: 'Type {word} to confirm.',
        qc: 'Saisissez {word} pour confirmer.',
    },
    vaultResetting: {
        en: 'Resetting…',
        qc: 'Réinitialisation…',
    },
    vaultEraseAndStartOver: {
        en: 'Erase and start over',
        qc: 'Effacer et recommencer',
    },
    vaultResetFailed: {
        en: 'Reset failed.',
        qc: 'Échec de la réinitialisation.',
    },

    /* ------------------------------------------------------------- devices */
    vaultLoadingDevices: {
        en: 'Loading devices…',
        qc: 'Chargement des appareils…',
    },
    vaultNoDevices: {
        en: 'No devices registered yet.',
        qc: 'Aucun appareil enregistré pour l’instant.',
    },
    deviceMaster: {
        en: 'Master',
        qc: 'Maître',
    },

    /* ----------------------------------------------------- identity editor */
    fieldGender: {
        en: 'Gender',
        qc: 'Genre',
    },
    genderMale: {
        en: 'Male',
        qc: 'Homme',
    },
    genderFemale: {
        en: 'Female',
        qc: 'Femme',
    },
    genderNonBinary: {
        en: 'Non-binary',
        qc: 'Non binaire',
    },
    genderOther: {
        en: 'Other',
        qc: 'Autre',
    },
    fieldBirthDate: {
        en: 'Birth Date',
        qc: 'Date de naissance',
    },
    fieldNationality: {
        en: 'Nationality',
        qc: 'Nationalité',
    },
    fieldBio: {
        en: 'Bio',
        qc: 'Bio',
    },
    fieldPhone: {
        en: 'Phone',
        qc: 'Téléphone',
    },
    sectionAddress: {
        en: 'Address',
        qc: 'Adresse',
    },
    vaultContact: {
        en: 'Contact',
        qc: 'Contact',
    },
    vaultLinkedItems: {
        en: 'Linked Items ({n})',
        qc: 'Éléments liés ({n})',
    },
    vaultAssignExisting: {
        en: 'Assign existing item',
        qc: 'Assigner un élément existant',
    },
    vaultNoLinkedItems: {
        en: 'No items linked to this identity yet.',
        qc: 'Aucun élément lié à cette identité pour l’instant.',
    },
    vaultUnassign: {
        en: 'Unassign',
        qc: 'Désassigner',
    },

    /* ------------------------------------------------- recovery kit restore */
    kitRestoreLink: {
        en: 'Restore from recovery kit',
        qc: 'Restaurer à partir de la trousse de récupération',
    },
    kitRestoreTitle: {
        en: 'Restore from a recovery kit',
        qc: 'Restaurer à partir d\u2019une trousse de récupération',
    },
    kitRestoreBody: {
        en: 'If this vault lost its account keys — it unlocks but nothing decrypts or saves — import the recovery kit file you downloaded at setup and enter its PIN. Everything sealed to your account becomes readable again.',
        qc: 'Si ce coffre a perdu ses clés de compte — il se déverrouille mais rien ne se déchiffre et rien ne s\u2019enregistre — importez le fichier de trousse de récupération téléchargé à la configuration et saisissez son NIP. Tout ce qui est scellé à votre compte redevient lisible.',
    },
    kitRestoreFileLabel: {
        en: 'Recovery kit file',
        qc: 'Fichier de trousse de récupération',
    },
    kitRestoreChooseFile: {
        en: 'Choose kit file',
        qc: 'Choisir le fichier de trousse',
    },
    kitRestoreFileLoaded: {
        en: 'Kit loaded: {name}',
        qc: 'Trousse chargée : {name}',
    },
    kitRestorePinLabel: {
        en: 'Recovery kit PIN',
        qc: 'NIP de la trousse de récupération',
    },
    kitRestoreAction: {
        en: 'Restore vault',
        qc: 'Restaurer le coffre',
    },
    kitRestoreSuccess: {
        en: 'Vault restored.',
        qc: 'Coffre restauré.',
    },
    kitRestoreFailed: {
        en: 'Restore failed.',
        qc: 'La restauration a échoué.',
    },
    kitRestoreReadFailed: {
        en: 'Could not read that file.',
        qc: 'Impossible de lire ce fichier.',
    },
} satisfies StringTable;

export type StringKey = keyof typeof STRINGS;

function detectLocale(): Locale {
    const language = (
        typeof navigator !== 'undefined' ? navigator.language : 'en'
    ).toLowerCase();
    return language.startsWith('fr') ? 'qc' : 'en';
}

let activeLocale: Locale = detectLocale();

export function getLocale(): Locale {
    return activeLocale;
}

export function setLocale(locale: Locale): void {
    activeLocale = locale;
}

/**
 * Looks up a string and substitutes `{name}` placeholders.
 */
export function t(key: StringKey, vars?: Record<string, string>): string {
    const entry = STRINGS[key];
    let value = entry[activeLocale] ?? entry.en;
    if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
            value = value.split(`{${name}}`).join(replacement);
        }
    }
    return value;
}
