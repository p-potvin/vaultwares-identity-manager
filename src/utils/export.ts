import type { VaultItem, LoginItem, CardItem, AddressItem, TotpItem, PasskeyItem } from '../types';

export function escapeCsvField(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function vaultItemsToCsv(items: VaultItem[]): string {
    const headers = [
        'title',
        'type',
        'username',
        'email',
        'password',
        'totp_uri',
        'urls',
        'vault',
        'pinned',
        'note',
        'created_at',
        'modified_at',
    ];

    const rows: string[] = [headers.join(',')];

    for (const item of items) {
        if (item.deletedAt) continue;

        let username = '';
        let email = '';
        let password = '';
        let totpUri = '';
        let urls = '';
        let note = '';

        switch (item.itemType) {
            case 'login': {
                const login = item.data as LoginItem;
                username = login.username ?? '';
                email = login.email ?? '';
                password = login.password ?? '';
                if (login.totpSecret) {
                    const account = email || username || 'Account';
                    totpUri = `otpauth://totp/${encodeURIComponent(item.metadata.label)}:${encodeURIComponent(account)}?secret=${encodeURIComponent(login.totpSecret)}&digits=6&period=30`;
                }
                urls = login.url ? (login.url.startsWith('http') ? login.url : `https://${login.url}`) : '';
                note = login.notes ?? '';
                break;
            }
            case 'totp': {
                const totp = item.data as TotpItem;
                totpUri = `otpauth://totp/${encodeURIComponent(totp.label || item.metadata.label)}?secret=${encodeURIComponent(totp.secret)}&digits=${totp.digits}&period=${totp.period}&algorithm=${totp.algorithm}`;
                break;
            }
            case 'card': {
                const card = item.data as CardItem;
                username = card.holderName;
                note = [
                    `Card: ${card.cardNumber}`,
                    `Exp: ${card.expiryMonth}/${card.expiryYear}`,
                    card.notes ?? '',
                ].filter(Boolean).join('\n');
                break;
            }
            case 'address': {
                const addr = item.data as AddressItem;
                username = addr.fullName;
                note = [addr.street, `${addr.city}, ${addr.state} ${addr.zipCode}`, addr.country, addr.phone ?? ''].filter(Boolean).join('\n');
                break;
            }
            case 'passkey': {
                const pk = item.data as PasskeyItem;
                username = pk.userName ?? '';
                urls = pk.rpId ? `https://${pk.rpId}` : '';
                note = pk.notes ?? `Passkey (${pk.credentialId})`;
                break;
            }
        }

        const vaultTag = item.metadata.tags.find(t => t.startsWith('vault:'))?.slice(6) ?? 'Personal';

        const row = [
            escapeCsvField(item.metadata.label),
            escapeCsvField(item.itemType),
            escapeCsvField(username),
            escapeCsvField(email),
            escapeCsvField(password),
            escapeCsvField(totpUri),
            escapeCsvField(urls),
            escapeCsvField(vaultTag),
            escapeCsvField(item.metadata.favorite ? 'true' : 'false'),
            escapeCsvField(note),
            escapeCsvField(item.createdAt),
            escapeCsvField(item.updatedAt),
        ];

        rows.push(row.join(','));
    }

    return rows.join('\r\n');
}

export function downloadVaultCsv(
    items: VaultItem[],
    filename = `vaultwares_export_${new Date().toISOString().split('T')[0]}.csv`,
): void {
    const csvContent = vaultItemsToCsv(items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
