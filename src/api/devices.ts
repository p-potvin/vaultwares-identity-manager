import { apiFetch } from './client';
import type { DeviceRegisterRequest, DeviceRegisterResponse, DeviceListResponse, DeviceInfo } from '../types';

export async function registerDevice(req: DeviceRegisterRequest): Promise<DeviceRegisterResponse> {
    return apiFetch('/devices', {
        method: 'POST',
        body: JSON.stringify(req),
    });
}

export async function listDevices(): Promise<DeviceListResponse> {
    return apiFetch('/devices');
}

export async function approveDevice(deviceId: string, approvalSignature: string): Promise<DeviceInfo> {
    return apiFetch(`/devices/${deviceId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvalSignature }),
    });
}

export async function revokeDevice(deviceId: string): Promise<void> {
    await apiFetch(`/devices/${deviceId}`, { method: 'DELETE' });
}

export async function promoteDevice(deviceId: string): Promise<DeviceInfo> {
    return apiFetch(`/devices/${deviceId}/promote`, { method: 'POST' });
}
