import type { Message, MessageResponse } from '../types';
import {
    getVault,
    saveIdentity,
    saveCredential,
    deleteIdentity,
    deleteCredential,
    getSettings,
    updateSettings,
} from '../utils/storage';
import { generateIdentity } from '../utils/identity-generator';
import { generatePassword } from '../utils/password-generator';

chrome.runtime.onMessage.addListener(
    (msg: Message, _sender, sendResponse: (r: MessageResponse) => void) => {
        handleMessage(msg)
            .then(sendResponse)
            .catch(err =>
                sendResponse({ success: false, error: String(err) }),
            );

        return true;
    },
);

const handleMessage = async (msg: Message): Promise<MessageResponse> => {
    switch (msg.type) {
        case 'GET_VAULT':
            return { success: true, data: await getVault() };

        case 'GET_SETTINGS':
            return { success: true, data: await getSettings() };

        case 'UPDATE_SETTINGS': {
            const settings = msg.payload as Parameters<typeof updateSettings>[0];
            await updateSettings(settings);
            return { success: true };
        }

        case 'SAVE_IDENTITY': {
            const identity = msg.payload as Parameters<typeof saveIdentity>[0];
            await saveIdentity(identity);
            return { success: true };
        }

        case 'DELETE_IDENTITY': {
            await deleteIdentity(msg.payload as string);
            return { success: true };
        }

        case 'SAVE_CREDENTIAL': {
            const credential = msg.payload as Parameters<typeof saveCredential>[0];
            await saveCredential(credential);
            return { success: true };
        }

        case 'DELETE_CREDENTIAL': {
            await deleteCredential(msg.payload as string);
            return { success: true };
        }

        case 'GENERATE_IDENTITY': {
            const identity = generateIdentity();
            await saveIdentity(identity);
            return { success: true, data: identity };
        }

        case 'GENERATE_PASSWORD': {
            const opts = msg.payload as Parameters<typeof generatePassword>[0];
            const password = generatePassword(opts);
            return { success: true, data: password };
        }

        default:
            return { success: false, error: 'Unknown message type' };
    }
};

export {};
