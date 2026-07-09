import { apiFetch, setTokens, clearTokens } from './client';
import type { AuthRegisterRequest, AuthRegisterResponse } from '../types';

export async function register(req: AuthRegisterRequest): Promise<AuthRegisterResponse> {
    const resp = await apiFetch<AuthRegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(req),
    });
    await setTokens(resp.accessToken, resp.refreshToken);
    return resp;
}

export async function login(email: string): Promise<{ deviceId: string; approvalState: string }> {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

export async function logout(): Promise<void> {
    await clearTokens();
}
