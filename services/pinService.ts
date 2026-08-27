/**
 * App lock PIN for Settings → Privacy & Security.
 *
 * The PIN modal used to collect a code and throw it away — the toggle flipped a boolean
 * and nothing ever asked for a PIN again. This stores it and backs a real lock screen.
 *
 * Stored as a SHA-256 hash with a random salt rather than in the clear. This guards
 * against someone reading localStorage; it is a convenience lock on a device-local app,
 * not a replacement for signing in.
 */

const PIN_KEY = 'smartpantry_pin';
const UNLOCKED_KEY = 'smartpantry_unlocked';

interface StoredPin {
  salt: string;
  hash: string;
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

const hashPin = async (pin: string, salt: string): Promise<string> => {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

const readStored = (): StoredPin | null => {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.salt === 'string' && typeof parsed?.hash === 'string' ? parsed : null;
  } catch {
    return null;
  }
};

export const isPinSet = (): boolean => readStored() !== null;

export const setPin = async (pin: string): Promise<void> => {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash }));
  markUnlocked();
};

export const verifyPin = async (pin: string): Promise<boolean> => {
  const stored = readStored();
  if (!stored) return false;
  const hash = await hashPin(pin, stored.salt);
  const ok = hash === stored.hash;
  if (ok) markUnlocked();
  return ok;
};

export const clearPin = (): void => {
  localStorage.removeItem(PIN_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
};

/** Unlocking lasts for the browser session, so navigating around doesn't re-prompt. */
export const markUnlocked = (): void => {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, 'true');
  } catch {
    /* private mode — the user will just be asked again */
  }
};

export const isUnlocked = (): boolean => {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const lockNow = (): void => {
  sessionStorage.removeItem(UNLOCKED_KEY);
};
