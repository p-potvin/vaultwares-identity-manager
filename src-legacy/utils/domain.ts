/**
 * Domain normalization utilities for the Identity Manager extension.
 *
 * Provides consistent domain key derivation for login/signup suggestions
 * and domain-identity linking (see DomainProfile / DomainIdentityLink types).
 *
 * Follows the data-contracts.md guidance: normalized_domain is the canonical
 * lookup key and must strip scheme, path, query, and fragment, collapse
 * redundant subdomains, and handle known SSO clusters.
 */

/** Known subdomain prefixes that should be stripped when normalizing. */
const STRIP_SUBDOMAINS = new Set([
    'www', 'app', 'my', 'me', 'account', 'accounts', 'auth', 'login',
    'signin', 'signup', 'id', 'sso', 'secure', 'portal', 'web',
]);

/**
 * Maps well-known SSO / shared-auth cluster domains to a single canonical key
 * so that credentials for google.com also match accounts.google.com, etc.
 */
const DOMAIN_CLUSTERS: Record<string, string> = {
    'accounts.google.com': 'google.com',
    'myaccount.google.com': 'google.com',
    'login.microsoftonline.com': 'microsoft.com',
    'login.live.com': 'microsoft.com',
    'appleid.apple.com': 'apple.com',
    'idmsa.apple.com': 'apple.com',
    'github.com': 'github.com',
    'api.github.com': 'github.com',
};

/**
 * Returns the eTLD+1-style normalized domain key used for vault lookups.
 *
 * Examples:
 *   https://app.example.com/login  → example.com
 *   https://accounts.google.com    → google.com  (cluster mapping)
 *   https://my.service.co.uk/auth  → service.co.uk
 */
export const normalizeDomain = (input: string): string => {
    let hostname: string;

    try {
        hostname = input.startsWith('http') ? new URL(input).hostname : input;
    } catch {
        hostname = input;
    }

    hostname = hostname.toLowerCase().replace(/:\d+$/, '');

    const clustered = DOMAIN_CLUSTERS[hostname];
    if (clustered) return clustered;

    const parts = hostname.split('.');

    if (parts.length <= 2) return hostname;

    const subdomain = parts[0];
    if (subdomain !== undefined && STRIP_SUBDOMAINS.has(subdomain)) {
        return parts.slice(1).join('.');
    }

    return hostname;
};

/** Returns a human-readable display version of the normalized domain. */
export const displayDomain = (normalized: string): string => normalized;

/**
 * Returns true when the current page URL's normalized domain matches a
 * stored domain key.
 */
export const domainMatches = (pageUrl: string, storedDomain: string): boolean =>
    normalizeDomain(pageUrl) === storedDomain;
