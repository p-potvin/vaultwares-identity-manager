import type { DetectedField, Identity } from '../types';

const COUNTRY_CODES: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    AU: 'Australia',
    NZ: 'New Zealand',
    DE: 'Germany',
    IE: 'Ireland',
};

/** Dispatch native input/change events so React/Vue/Angular pick up the value. */
const nativeSet = (el: HTMLInputElement | HTMLSelectElement, value: string): void => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLInputElement
            ? window.HTMLInputElement.prototype
            : window.HTMLSelectElement.prototype,
        'value',
    )?.set;

    nativeInputValueSetter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
};

const fillField = (
    field: DetectedField,
    identity: Identity,
    password: string,
): boolean => {
    const { element, role } = field;

    if (element instanceof HTMLSelectElement) {
        const countryFull = COUNTRY_CODES[identity.address.country] ?? identity.address.country;

        const matchOption = Array.from(element.options).find(
            o =>
                o.value.toUpperCase() === identity.address.country ||
                o.value.toLowerCase() === countryFull.toLowerCase() ||
                o.text.toLowerCase() === countryFull.toLowerCase() ||
                o.value.toLowerCase() === identity.address.state.toLowerCase() ||
                o.text.toLowerCase() === identity.address.state.toLowerCase(),
        );

        if (matchOption) {
            nativeSet(element, matchOption.value);
            return true;
        }

        return false;
    }

    const map: Partial<Record<typeof role, string>> = {
        firstName: identity.firstName,
        lastName: identity.lastName,
        fullName: `${identity.firstName} ${identity.lastName}`,
        email: identity.email,
        emailConfirm: identity.email,
        username: identity.username,
        password,
        passwordConfirm: password,
        phone: identity.phone,
        birthDate: identity.birthDate,
        street: identity.address.street,
        city: identity.address.city,
        state: identity.address.state,
        country: identity.address.country,
        zipCode: identity.address.zipCode,
    };

    const value = map[role];

    if (value !== undefined) {
        nativeSet(element, value);
        return true;
    }

    return false;
};

export const fillForm = (
    fields: DetectedField[],
    identity: Identity,
    password: string,
): number => {
    let filled = 0;

    for (const field of fields) {
        if (fillField(field, identity, password)) filled++;
    }

    return filled;
};
