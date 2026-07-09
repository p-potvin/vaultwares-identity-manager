interface FormField {
    element: HTMLInputElement;
    role: string;
    confidence: number;
}

interface FormDetectionResult {
    type: 'login' | 'signup' | 'none';
    fields: FormField[];
    score: number;
}

function detectFieldType(input: HTMLInputElement): string {
    const hints = [
        input.name, input.id, input.getAttribute('autocomplete') ?? '',
        input.getAttribute('placeholder') ?? '', input.type,
    ].join(' ').toLowerCase();

    if (/first.?name/.test(hints)) return 'firstName';
    if (/last.?name/.test(hints)) return 'lastName';
    if (/full.?name|^name$/.test(hints)) return 'fullName';
    if (/confirm.*pass|pass.*confirm|repeat.*pass/.test(hints)) return 'passwordConfirm';
    if (/pass|pwd/.test(hints) || input.type === 'password') return 'password';
    if (/email|e-mail/.test(hints)) return 'email';
    if (/user|handle|login/.test(hints) && input.type !== 'password') return 'username';
    if (/phone|tel|mobile/.test(hints)) return 'phone';
    if (/birth|dob/.test(hints)) return 'birthDate';
    if (/street|address/.test(hints)) return 'street';
    if (/city/.test(hints)) return 'city';
    if (/state|province/.test(hints)) return 'state';
    if (/zip|postal/.test(hints)) return 'zipCode';
    if (/country/.test(hints)) return 'country';
    if (/card.?number|cc.?num/.test(hints)) return 'cardNumber';
    if (/cvc|cvv|security.?code/.test(hints)) return 'cvv';
    if (/expir/.test(hints)) return 'expiry';
    if (/otp|totp|2fa|verification.?code/.test(hints)) return 'totp';
    return 'unknown';
}

function detectForms(): FormDetectionResult {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
        'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio])',
    ));

    if (inputs.length === 0) return { type: 'none', fields: [], score: 0 };

    const fields: FormField[] = inputs.map(input => ({
        element: input,
        role: detectFieldType(input),
        confidence: 1,
    }));

    const hasPassword = fields.some(f => f.role === 'password');
    const hasEmail = fields.some(f => f.role === 'email');
    const hasConfirmPassword = fields.some(f => f.role === 'passwordConfirm');
    const hasFirstName = fields.some(f => f.role === 'firstName' || f.role === 'fullName');
    const hasUsername = fields.some(f => f.role === 'username');

    let type: 'login' | 'signup' | 'none' = 'none';
    let score = 0;

    if (hasPassword && hasConfirmPassword) {
        type = 'signup';
        score = 90;
    } else if (hasPassword && hasFirstName) {
        type = 'signup';
        score = 80;
    } else if (hasPassword && (hasEmail || hasUsername)) {
        type = 'login';
        score = 85;
    } else if (hasPassword) {
        type = 'login';
        score = 60;
    }

    return { type, fields, score };
}

function createInlineMenu(): HTMLElement | null {
    const existing = document.getElementById('vw-inline-menu');
    if (existing) existing.remove();

    const detection = detectForms();
    if (detection.type === 'none' || detection.score < 50) return null;

    const menu = document.createElement('div');
    menu.id = 'vw-inline-menu';
    menu.style.cssText = `
        position: fixed;
        z-index: 2147483647;
        background: #13101c;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        color: #a394cc;
        min-width: 280px;
        max-width: 360px;
        padding: 8px;
        display: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #D6A441;';
    header.textContent = detection.type === 'login' ? 'VaultWares — Logins' : 'VaultWares — Sign Up';
    menu.appendChild(header);

    const listContainer = document.createElement('div');
    listContainer.id = 'vw-inline-menu-list';
    menu.appendChild(listContainer);

    document.body.appendChild(menu);
    return menu;
}

function showInlineMenuNear(menu: HTMLElement, input: HTMLInputElement): void {
    const rect = input.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.display = 'block';
}

function fillField(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillForm(fields: FormField[], data: Record<string, string>): void {
    for (const field of fields) {
        if (data[field.role]) {
            fillField(field.element, data[field.role]);
        }
    }
}

function initContentScript(): void {
    let currentMenu: HTMLElement | null = null;
    let currentInput: HTMLInputElement | null = null;

    const detection = detectForms();
    if (detection.type === 'none') return;

    const passwordFields = detection.fields.filter(f => f.role === 'password' || f.role === 'email' || f.role === 'username' || f.role === 'cardNumber' || f.role === 'totp');

    for (const field of passwordFields) {
        field.element.addEventListener('focus', () => {
            if (currentMenu) currentMenu.remove();
            currentInput = field.element;

            chrome.runtime.sendMessage(
                { type: 'GET_PAGE_MATCHES', payload: { url: window.location.href } },
                (response) => {
                    if (!response?.success || !response.data?.length) return;

                    currentMenu = createInlineMenu();
                    if (!currentMenu) return;

                    const listContainer = currentMenu.querySelector('#vw-inline-menu-list');
                    if (!listContainer) return;

                    for (const item of response.data) {
                        const itemEl = document.createElement('div');
                        itemEl.style.cssText = 'padding: 10px 12px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 10px; transition: background 0.15s;';
                        itemEl.onmouseenter = () => { itemEl.style.background = '#2A2340'; };
                        itemEl.onmouseleave = () => { itemEl.style.background = ''; };

                        const icon = document.createElement('div');
                        icon.style.cssText = 'width: 28px; height: 28px; border-radius: 6px; background: #2A2340; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #D6A441; flex-shrink: 0;';
                        icon.textContent = (item.metadata.label || 'V')[0].toUpperCase();
                        itemEl.appendChild(icon);

                        const info = document.createElement('div');
                        info.style.cssText = 'flex: 1; min-width: 0;';
                        const label = document.createElement('div');
                        label.style.cssText = 'font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
                        label.textContent = item.metadata.label;
                        const sub = document.createElement('div');
                        sub.style.cssText = 'font-size: 11px; color: rgba(237,230,255,0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
                        sub.textContent = item.data.username || item.data.email || item.data.holderName || '';
                        info.appendChild(label);
                        info.appendChild(sub);
                        itemEl.appendChild(info);

                        itemEl.onclick = () => {
                            const fillData: Record<string, string> = {};
                            if (item.itemType === 'login') {
                                fillData.username = item.data.username || item.data.email || '';
                                fillData.email = item.data.email || '';
                                fillData.password = item.data.password || '';
                                if (item.data.totpSecret) {
                                    fillData.totp = item.data.totpSecret;
                                }
                            } else if (item.itemType === 'card') {
                                fillData.cardNumber = item.data.cardNumber || '';
                                fillData.cvv = item.data.cvv || '';
                            }
                            fillForm(detection.fields, fillData);
                            currentMenu?.remove();
                            currentMenu = null;
                        };

                        listContainer.appendChild(itemEl);
                    }

                    if (currentMenu && currentInput) {
                        showInlineMenuNear(currentMenu, currentInput);
                    }
                },
            );
        });
    }

    document.addEventListener('click', (e) => {
        if (currentMenu && !currentMenu.contains(e.target as Node)) {
            currentMenu.remove();
            currentMenu = null;
        }
    });
}

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initContentScript();
} else {
    document.addEventListener('DOMContentLoaded', initContentScript);
}
