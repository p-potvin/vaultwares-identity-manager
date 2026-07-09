const API_BASE = 'http://localhost:9001/v1';
const TOKEN_KEY = 'vw_access_token';
const REFRESH_TOKEN_KEY = 'vw_refresh_token';

export async function getAccessToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(TOKEN_KEY) as Record<string, any>;
    return result[TOKEN_KEY] ?? null;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await chrome.storage.local.set({
        [TOKEN_KEY]: accessToken,
        [REFRESH_TOKEN_KEY]: refreshToken,
    });
}

export async function clearTokens(): Promise<void> {
    await chrome.storage.local.remove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

async function refreshAccessToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(REFRESH_TOKEN_KEY) as Record<string, any>;
    const refreshToken = result[REFRESH_TOKEN_KEY] as string | undefined;
    if (!refreshToken) return null;

    try {
        const resp = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        await setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (resp.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
        }
    }

    if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error ?? `HTTP ${resp.status}`);
    }

    return resp.json() as Promise<T>;
}

export { API_BASE };
