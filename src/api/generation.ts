import { apiFetch, API_BASE } from './client';
import type { GeneratedIdentityData } from '../types';

const DEFAULT_GENERATION_PROMPT = `You are a persona generator. Generate a realistic fictional identity. Return ONLY valid JSON with this exact schema:
{
  "fullName": "string",
  "gender": "male" | "female" | "non-binary" | "other",
  "birthDate": "YYYY-MM-DD",
  "nationality": "string (country name)",
  "bio": "string (1-2 sentence background story)",
  "email": "string (plausible email based on the name)",
  "phone": "string (plausible phone number for the nationality)",
  "address": {
    "fullName": "same as fullName",
    "street": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string",
    "phone": "same as phone"
  }
}
Do not include any text before or after the JSON. Do not use markdown fences.`;

export interface GenerationOptions {
    gender?: 'male' | 'female' | 'non-binary' | 'other';
    nationality?: string;
    ageRange?: { min: number; max: number };
}

function buildPrompt(options?: GenerationOptions): string {
    let prompt = DEFAULT_GENERATION_PROMPT;
    if (options?.gender) {
        prompt += `\nThe gender should be: ${options.gender}.`;
    }
    if (options?.nationality) {
        prompt += `\nThe nationality should be: ${options.nationality}.`;
    }
    if (options?.ageRange) {
        const currentYear = new Date().getFullYear();
        const minYear = currentYear - options.ageRange.max;
        const maxYear = currentYear - options.ageRange.min;
        prompt += `\nThe birth year should be between ${minYear} and ${maxYear}.`;
    }
    return prompt;
}

export async function generateIdentityViaApi(options?: GenerationOptions): Promise<GeneratedIdentityData> {
    return apiFetch<GeneratedIdentityData>('/generate/identity', {
        method: 'POST',
        body: JSON.stringify({ options }),
    });
}

export async function generateIdentityViaCustomEndpoint(
    endpointUrl: string,
    options?: GenerationOptions,
): Promise<GeneratedIdentityData> {
    const prompt = buildPrompt(options);
    const resp = await fetch(`${endpointUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3.1',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: 'Generate a random fictional identity.' },
            ],
            format: 'json',
            stream: false,
        }),
    });

    if (!resp.ok) {
        throw new Error(`Generation endpoint returned HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const content = data?.message?.content ?? data?.content ?? data?.response ?? '';
    let parsed: GeneratedIdentityData;
    try {
        parsed = JSON.parse(content);
    } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Generation endpoint did not return valid JSON');
        parsed = JSON.parse(jsonMatch[0]);
    }

    return parsed;
}

export async function generateIdentity(
    customEndpointUrl: string | undefined,
    options?: GenerationOptions,
): Promise<GeneratedIdentityData> {
    if (customEndpointUrl) {
        return generateIdentityViaCustomEndpoint(customEndpointUrl, options);
    }
    return generateIdentityViaApi(options);
}
