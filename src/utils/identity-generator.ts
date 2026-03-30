import type { Identity } from '../types';

const FIRST_NAMES = [
    'Alice', 'Brian', 'Clara', 'David', 'Emma', 'Frank', 'Grace', 'Henry',
    'Iris', 'James', 'Karen', 'Liam', 'Mia', 'Nathan', 'Olivia', 'Peter',
    'Quinn', 'Rachel', 'Samuel', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xavier',
    'Yara', 'Zane', 'Aria', 'Blake', 'Chloe', 'Dylan', 'Elena', 'Finn',
    'Gemma', 'Hugo', 'Isla', 'Jake', 'Kylie', 'Leo', 'Maya', 'Noah',
    'Paige', 'Riley', 'Sofia', 'Tyler', 'Ursula', 'Violet', 'Wade', 'Xena',
    'Yasmin', 'Zoe',
];

const LAST_NAMES = [
    'Adams', 'Brown', 'Carter', 'Davis', 'Evans', 'Foster', 'Garcia',
    'Harris', 'Ingram', 'Jones', 'King', 'Lewis', 'Moore', 'Nelson',
    'Owen', 'Parker', 'Quinn', 'Roberts', 'Smith', 'Taylor', 'Turner',
    'United', 'Vance', 'Walker', 'Xavier', 'Young', 'Zimmerman', 'Allen',
    'Baker', 'Clark', 'Dixon', 'Ellis', 'Ford', 'Grant', 'Hall', 'Irwin',
    'Johnson', 'Kent', 'Lane', 'Martin', 'Nixon', 'Olsen', 'Price',
    'Reed', 'Scott', 'Thomas', 'Upton', 'Vogel', 'Webb', 'York',
];

const STREET_NAMES = [
    'Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Birch', 'Walnut', 'Willow',
    'Spruce', 'Ash', 'Sycamore', 'Poplar', 'Chestnut', 'Magnolia', 'Laurel',
    'Juniper', 'Aspen', 'Redwood', 'Cypress', 'Hazel', 'Maplewood', 'Riverside',
    'Highland', 'Lakeside', 'Hillcrest', 'Sunset', 'Sunrise', 'Meadow', 'Valley',
    'Orchard',
];

const STREET_SUFFIXES = [
    'Ave', 'Blvd', 'Ct', 'Dr', 'Lane', 'Pkwy', 'Pl', 'Rd', 'St', 'Way',
];

interface CityData {
    city: string;
    state: string;
    country: string;
    zip: string;
}

const CITY_DATA: CityData[] = [
    { city: 'Austin', state: 'TX', country: 'US', zip: '78701' },
    { city: 'Boston', state: 'MA', country: 'US', zip: '02101' },
    { city: 'Chicago', state: 'IL', country: 'US', zip: '60601' },
    { city: 'Denver', state: 'CO', country: 'US', zip: '80201' },
    { city: 'Houston', state: 'TX', country: 'US', zip: '77001' },
    { city: 'Las Vegas', state: 'NV', country: 'US', zip: '89101' },
    { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90001' },
    { city: 'Miami', state: 'FL', country: 'US', zip: '33101' },
    { city: 'Nashville', state: 'TN', country: 'US', zip: '37201' },
    { city: 'New York', state: 'NY', country: 'US', zip: '10001' },
    { city: 'Orlando', state: 'FL', country: 'US', zip: '32801' },
    { city: 'Philadelphia', state: 'PA', country: 'US', zip: '19101' },
    { city: 'Phoenix', state: 'AZ', country: 'US', zip: '85001' },
    { city: 'Portland', state: 'OR', country: 'US', zip: '97201' },
    { city: 'San Diego', state: 'CA', country: 'US', zip: '92101' },
    { city: 'San Francisco', state: 'CA', country: 'US', zip: '94102' },
    { city: 'Seattle', state: 'WA', country: 'US', zip: '98101' },
    { city: 'Calgary', state: 'AB', country: 'CA', zip: 'T2P 1J9' },
    { city: 'Montreal', state: 'QC', country: 'CA', zip: 'H2Y 1C6' },
    { city: 'Ottawa', state: 'ON', country: 'CA', zip: 'K1A 0A9' },
    { city: 'Toronto', state: 'ON', country: 'CA', zip: 'M5H 2N2' },
    { city: 'Vancouver', state: 'BC', country: 'CA', zip: 'V6B 2W9' },
    { city: 'Birmingham', state: 'England', country: 'GB', zip: 'B1 1BB' },
    { city: 'London', state: 'England', country: 'GB', zip: 'EC1A 1BB' },
    { city: 'Manchester', state: 'England', country: 'GB', zip: 'M1 1AE' },
    { city: 'Melbourne', state: 'VIC', country: 'AU', zip: '3000' },
    { city: 'Sydney', state: 'NSW', country: 'AU', zip: '2000' },
    { city: 'Auckland', state: 'Auckland', country: 'NZ', zip: '1010' },
    { city: 'Dublin', state: 'Leinster', country: 'IE', zip: 'D01 F5P2' },
    { city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10115' },
];

/** Username word pool — short, memorable, safe words. */
const WORDS = [
    'amber', 'anchor', 'apple', 'arrow', 'atlas', 'azure', 'badge', 'beacon',
    'birch', 'blaze', 'bloom', 'bolt', 'brave', 'breeze', 'bright', 'brook',
    'calm', 'cedar', 'cipher', 'cliff', 'cloud', 'coast', 'cobalt', 'coral',
    'crane', 'creek', 'crown', 'crystal', 'dawn', 'delta', 'dew', 'dune',
    'eagle', 'echo', 'ember', 'fern', 'field', 'fjord', 'flame', 'flint',
    'forest', 'forge', 'frost', 'gale', 'gem', 'glacier', 'glow', 'grove',
    'haven', 'hawk', 'haze', 'helm', 'horizon', 'hue', 'ice', 'inlet',
    'iris', 'iron', 'ivory', 'jade', 'jasper', 'jewel', 'keen', 'knoll',
    'lake', 'lance', 'lark', 'leaf', 'lens', 'light', 'link', 'loch',
    'lunar', 'maple', 'marble', 'marsh', 'mast', 'meadow', 'mesa', 'mist',
    'moat', 'moon', 'moss', 'mount', 'nebula', 'nexus', 'nook', 'north',
    'nova', 'oasis', 'ocean', 'onyx', 'orbit', 'pebble', 'peak', 'pine',
    'pixel', 'plain', 'prism', 'pulse', 'quartz', 'quest', 'rain', 'rapid',
    'raven', 'reef', 'ridge', 'rift', 'ripple', 'river', 'rock', 'rune',
    'sage', 'sand', 'shore', 'signal', 'silver', 'sky', 'slate', 'snow',
    'solar', 'spark', 'spring', 'sprout', 'star', 'steel', 'stone', 'storm',
    'stream', 'summit', 'surf', 'swift', 'terra', 'tide', 'timber', 'trace',
    'trek', 'trend', 'vale', 'vapor', 'vault', 'veil', 'violet', 'vista',
    'wake', 'wave', 'west', 'willow', 'wind', 'wing', 'winter', 'wisp',
    'zenith', 'zephyr',
];

const EMAIL_DOMAINS = [
    'gmail.com', 'outlook.com', 'yahoo.com', 'proton.me',
    'icloud.com', 'hotmail.com', 'mail.com',
];

const randomInt = (max: number): number =>
    Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]! / (0xffffffff + 1) * max);

const pick = <T>(arr: T[]): T => arr[randomInt(arr.length)]!;

const nanoid = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 12 }, () => pick(chars.split(''))).join('');
};

export const generateUsername = (): string => {
    const word1 = pick(WORDS);
    const word2 = pick(WORDS);
    const num = randomInt(900) + 100;

    return `${word1}${word2}${num}`;
};

export const generateIdentity = (label?: string): Identity => {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const cityData = pick(CITY_DATA);
    const streetNum = randomInt(9000) + 100;
    const streetName = pick(STREET_NAMES);
    const streetSuffix = pick(STREET_SUFFIXES);
    const username = generateUsername();
    const emailDomain = pick(EMAIL_DOMAINS);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(900) + 100}@${emailDomain}`;
    const now = Date.now();

    const birthYear = 1970 + randomInt(35);
    const birthMonth = String(randomInt(12) + 1).padStart(2, '0');
    const birthDay = String(randomInt(28) + 1).padStart(2, '0');
    const areaCode = String(randomInt(900) + 100);
    const phonePart = String(randomInt(9000000) + 1000000);

    return {
        id: nanoid(),
        label: label ?? `${firstName} ${lastName}`,
        firstName,
        lastName,
        email,
        username,
        phone: `+1 (${areaCode}) ${phonePart.slice(0, 3)}-${phonePart.slice(3)}`,
        birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
        address: {
            street: `${streetNum} ${streetName} ${streetSuffix}`,
            city: cityData.city,
            state: cityData.state,
            country: cityData.country,
            zipCode: cityData.zip,
        },
        createdAt: now,
        updatedAt: now,
    };
};
