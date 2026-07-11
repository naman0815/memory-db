/**
 * App-open lock using WebAuthn against the device's platform authenticator
 * (Face ID / Touch ID on Apple devices, Windows Hello, Android biometrics).
 *
 * Important trade-off: this is a UI gate, not encryption. A successful
 * navigator.credentials.get() proves the OS verified the user biometrically,
 * but the underlying IndexedDB data is not encrypted with a key derived from
 * it — anyone bypassing the JS (e.g. via devtools on an unlocked device)
 * could still read local data. There's no backend to hold a real secret
 * against, so this matches the "Notes app lock" threat model, not a vault.
 */

const ENABLED_KEY = 'faceid-enabled'
const CREDENTIAL_ID_KEY = 'faceid-credential-id'

export function isLockEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)).buffer
}

/** Enroll Face ID / Touch ID for this app. Must run from a user gesture (button click). */
export async function enableLock(): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Memory DB' },
      user: { id: userId, name: 'memory-db-user', displayName: 'Memory DB' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('Face ID enrollment was cancelled')
  localStorage.setItem(CREDENTIAL_ID_KEY, toBase64Url(credential.rawId))
  localStorage.setItem(ENABLED_KEY, 'true')
}

export function disableLock(): void {
  localStorage.removeItem(ENABLED_KEY)
  localStorage.removeItem(CREDENTIAL_ID_KEY)
}

/** Prompt Face ID / Touch ID. Resolves true only if the OS verified the user. */
export async function verifyUnlock(): Promise<boolean> {
  const storedId = localStorage.getItem(CREDENTIAL_ID_KEY)
  if (!storedId) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: fromBase64Url(storedId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return assertion !== null
  } catch {
    // User cancelled, timed out, or failed verification
    return false
  }
}
