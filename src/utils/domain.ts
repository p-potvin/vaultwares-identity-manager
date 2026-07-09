export function normalizeDomain(url: string): string {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    } catch {
        return '';
    }
}

export function getFullDomain(url: string): string {
    try {
        const u = new URL(url);
        return u.hostname.toLowerCase();
    } catch {
        return '';
    }
}

export function getFaviconUrl(url: string): string {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch {
        return '';
    }
}

export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}
