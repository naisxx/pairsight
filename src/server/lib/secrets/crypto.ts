import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Encrypts a credential an admin saves in the app (the Jev key), so the
// database never holds it in the clear: AES-256-GCM under a key that lives
// only in the server's environment (PAIRSIGHT_SECRET_KEY). GCM's tag means a
// changed byte, or the wrong key, fails to decrypt rather than giving back
// something wrong.
//
// Stored as one blob: a version byte, the 12-byte IV, the 16-byte tag, then
// the ciphertext. The version leaves room to change the scheme later without
// guessing what an old blob is.

const VERSION = 1
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32
const ALGORITHM = 'aes-256-gcm'

export class SecretUnreadableError extends Error {
	constructor() {
		super('A stored secret could not be decrypted')
		this.name = 'SecretUnreadableError'
	}
}

// The encryption key from its base64 form, or null when there isn't one.
export function secretKeyFrom(base64: string | undefined): Buffer | null {
	if (base64 == null || base64 === '') return null
	const key = Buffer.from(base64, 'base64')
	return key.length === KEY_BYTES ? key : null
}

// A plain Uint8Array over its own ArrayBuffer, as Prisma takes for a Bytes column.
export function encryptSecret(plain: string, key: Buffer): Uint8Array<ArrayBuffer> {
	const iv = randomBytes(IV_BYTES)
	const cipher = createCipheriv(ALGORITHM, key, iv)
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
	return new Uint8Array(
		Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext])
	)
}

// Throws SecretUnreadableError for anything it can't read back: another key,
// a changed byte, or a blob from a scheme it doesn't know.
export function decryptSecret(blob: Uint8Array, key: Buffer): string {
	const bytes = Buffer.from(blob)
	if (bytes.length < 1 + IV_BYTES + TAG_BYTES || bytes[0] !== VERSION) {
		throw new SecretUnreadableError()
	}
	const iv = bytes.subarray(1, 1 + IV_BYTES)
	const tag = bytes.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES)
	const ciphertext = bytes.subarray(1 + IV_BYTES + TAG_BYTES)
	try {
		const decipher = createDecipheriv(ALGORITHM, key, iv)
		decipher.setAuthTag(tag)
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
	} catch {
		throw new SecretUnreadableError()
	}
}
