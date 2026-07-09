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

function createNoMatchesItem(menu: HTMLElement, listContainer: HTMLElement): void {
    const noMatches = document.createElement('div');
    noMatches.style.cssText = 'padding: 10px 12px; color: rgba(237,230,255,0.5); font-size: 12px; text-align: center;';
    noMatches.textContent = 'No matching logins found';
    listContainer.appendChild(noMatches);

    const createBtn = document.createElement('div');
    createBtn.style.cssText = 'padding: 10px 12px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 10px; transition: background 0.15s; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 4px;';
    createBtn.onmouseenter = () => { createBtn.style.background = '#2A2340'; };
    createBtn.onmouseleave = () => { createBtn.style.background = ''; };

    const plusIcon = document.createElement('div');
    plusIcon.style.cssText = 'width: 28px; height: 28px; border-radius: 6px; background: #2A2340; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #D6A441; flex-shrink: 0;';
    plusIcon.textContent = '+';
    createBtn.appendChild(plusIcon);

    const label = document.createElement('div');
    label.style.cssText = 'font-size: 13px; font-weight: 500; color: #D6A441;';
    label.textContent = 'Create new login for this site';
    createBtn.appendChild(label);

    createBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP_CREATE', payload: { url: window.location.href } });
        menu.remove();
    };
    listContainer.appendChild(createBtn);
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

    function loadAndShowMatches(input: HTMLInputElement): void {
        if (currentMenu) currentMenu.remove();
        currentInput = input;

        chrome.runtime.sendMessage(
            { type: 'GET_PAGE_MATCHES', payload: { url: window.location.href } },
            (response) => {
                currentMenu = createInlineMenu();
                if (!currentMenu) return;

                const listContainer = currentMenu.querySelector('#vw-inline-menu-list');
                if (!listContainer) return;

                if (!response?.success || !response.data?.length) {
                    createNoMatchesItem(currentMenu, listContainer as HTMLElement);
                } else {
                    const items: any[] = response.data;
                    const withIdentity = items.filter((i: any) => i.identityId);
                    const withoutIdentity = items.filter((i: any) => !i.identityId);
                    const identityIds = [...new Set(withIdentity.map((i: any) => i.identityId))];

                    const renderitem = (item: any) => {
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
                            chrome.runtime.sendMessage({ type: 'UPDATE_ITEM_LAST_USED', payload: { itemId: item.id } });
                            currentMenu?.remove();
                            currentMenu = null;
                        };

                        listContainer.appendChild(itemEl);
                    };

                    for (const identityId of identityIds) {
                        const idItems = withIdentity.filter((i: any) => i.identityId === identityId);
                        if (idItems.length === 0) continue;

                        const header = document.createElement('div');
                        header.style.cssText = 'padding: 6px 12px 2px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(214,164,65,0.7);';
                        header.textContent = idItems[0].metadata.label?.split(' ')[0] || 'Identity';
                        listContainer.appendChild(header);

                        idItems.forEach(renderitem);
                    }

                    if (withoutIdentity.length > 0 && identityIds.length > 0) {
                        const divider = document.createElement('div');
                        divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.04); margin: 4px 0;';
                        listContainer.appendChild(divider);
                    }
                    withoutIdentity.forEach(renderitem);
                }

                if (currentMenu && currentInput) {
                    showInlineMenuNear(currentMenu, currentInput);
                }
            },
        );
    }

    for (const field of passwordFields) {
        field.element.addEventListener('focus', () => {
            loadAndShowMatches(field.element);
        });
    }

    if (detection.type === 'login' && detection.score >= 60) {
        const firstField = passwordFields[0];
        if (firstField) {
            setTimeout(() => {
                if (document.activeElement === firstField.element) return;
                loadAndShowMatches(firstField.element);
                setTimeout(() => {
                    if (currentMenu && !document.activeElement?.closest('#vw-inline-menu')) {
                        currentMenu.style.display = 'none';
                    }
                }, 4000);
            }, 800);
        }
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'AUTOFILL') {
        const detection = detectForms();
        if (detection.type === 'none') {
            sendResponse({ success: false, error: 'No form detected on this page' });
            return true;
        }
        const fillData: Record<string, string> = message.payload || {};
        fillForm(detection.fields, fillData);
        sendResponse({ success: true });
    }
    return true;
});
