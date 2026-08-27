import { markUnlocked } from './pinService';

/**
 * Biometric unlock for Settings → Privacy & Security, via WebAuthn's platform
 * authenticator (Windows Hello, Touch ID, Android fingerprint). The toggle previously
 * saved a boolean that nothing read.
 *
 * There is no server to verify the signature against, so this is a local convenience
 * gate of the same strength as the PIN — it proves the device owner is present, not
 * who they are. The PIN therefore always remains as a fallback, so a lost or reset
 * authenticator can never lock someone out of their own pantry.
 */

const CREDENTIAL_KEY = 'smartpantry_biometric_credential';

const randomBytes = (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length));

const toBase64 = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), c => c.charCodeAt(0));

export const biometricSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof PublicKeyCredential !== 'undefined' &&
  Boolean(navigator.credentials?.create);

/** Whether this device actually has a fingerprint reader / face unlock available. */
export const biometricAvailable = async (): Promise<boolean> => {
  if (!biometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

export const biometricEnrolled = (): boolean => localStorage.getItem(CREDENTIAL_KEY) !== null;

/** Enrol this device. Returns false if the user cancelled or it isn't available. */
export const enrolBiometric = async (): Promise<boolean> => {
  if (!(await biometricAvailable())) return false;
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'SmartPantry AI' },
        user: {
          id: randomBytes(16),
          name: 'smartpantry-local',
          displayName: 'SmartPantry',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },    // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    localStorage.setItem(CREDENTIAL_KEY, toBase64(credential.rawId));
    return true;
  } catch (err) {
    console.error('Biometric enrolment failed', err);
    return false;
  }
};

export const clearBiometric = (): void => localStorage.removeItem(CREDENTIAL_KEY);

/** Prompt for the fingerprint/face. Returns whether it succeeded. */
export const verifyBiometric = async (): Promise<boolean> => {
  const stored = localStorage.getItem(CREDENTIAL_KEY);
  if (!stored || !biometricSupported()) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64(stored) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (!assertion) return false;
    markUnlocked();
    return true;
  } catch (err) {
    console.error('Biometric check failed', err);
    return false;
  }
};
