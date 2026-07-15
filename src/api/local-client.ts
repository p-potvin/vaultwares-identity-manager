/**
 * HTTP client for the local vault-warden the extension syncs to (default
 * http://127.0.0.1:9444/v1 on this machine). Auth is the vault-warden local
 * token, which the user configures in settings. This deliberately does NOT go
 * through the cloud api.vaultwares.ca client in client.ts — vault sync is local.
 */
import { getSettings } from '../utils/storage';

const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:9444/v1';

export async function localFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const settings = await getSettings();
    const base = (settings.syncServerUrl || DEFAULT_LOCAL_BASE).replace(/\/$/, '');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (settings.syncLocalToken) {
        headers['X-VW-Local-Token'] = settings.syncLocalToken;
    }

    let resp: Response;
    try {
        resp = await fetch(`${base}${path}`, { ...options, headers });
    } catch (e) {
        throw new Error(`cannot reach local vault-warden at ${base} (is it running?): ${(e as Error).message}`);
    }

    if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
            const body = await resp.json();
            detail = body.detail ?? body.error ?? detail;
        } catch {
            // non-JSON error body
        }
        throw new Error(`local sync ${path} failed: ${detail}`);
    }

    return resp.json() as Promise<T>;
}
