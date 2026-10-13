import 'server-only'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { isOnPrem } from '@/server/deployment'
import {
	decryptSecret,
	encryptSecret,
	SecretUnreadableError,
	secretKeyFrom
} from '@/server/lib/secrets/crypto'

// Which Jev key and address this server's calls use: the connection an admin
// saved on the Settings page (prisma/schema/jev.prisma), else (hosted only) the
// server's own TYPESAFE_API_KEY and TYPESAFE_API_BASE_URL. On-prem the customer
// brings their own key, so a key in the server's environment is ignored there
// and runs wait for an admin to save one. Saved connections belong to a
// worker pool, so a dev server and the e2e server on one database don't share
// one. typesafe.ts asks here before every call; nothing else reads the key.

export type JevCredentials = { apiKey: string; baseUrl: string }

// How long a server keeps what it read before reading again: a change saved
// on another server sharing the database reaches this one within it.
const CACHE_MS = 30_000
const LAST_CHARS = 4

// The last read, kept on globalThis: the run worker and the Settings action
// load this module separately, and a save must clear the worker's copy too.
const CACHE = Symbol.for('pairsight.jevCredentials')
type CacheHolder = { [CACHE]?: { value: JevCredentials | null; at: number } }
const holder = globalThis as CacheHolder

function serverCredentials(): JevCredentials | null {
	if (isOnPrem()) return null
	const apiKey = env.TYPESAFE_API_KEY
	return apiKey == null || apiKey === '' ? null : { apiKey, baseUrl: env.TYPESAFE_API_BASE_URL }
}

function encryptionKey(): Buffer | null {
	return secretKeyFrom(env.PAIRSIGHT_SECRET_KEY)
}

// Whether this server can store a key at all (it has an encryption key).
export function canSaveJevConnection(): boolean {
	return encryptionKey() != null
}

async function savedConnection() {
	return db.jevConnection.findUnique({ where: { pool: env.RUN_WORKER_POOL } })
}

// The saved key, decrypted, or null: none saved, or one this server can't
// read (no encryption key, or a different one), which Settings points out.
async function savedCredentials(): Promise<JevCredentials | null> {
	const key = encryptionKey()
	if (key == null) return null
	const row = await savedConnection()
	if (row == null) return null
	try {
		return { apiKey: decryptSecret(row.keyCipher, key), baseUrl: row.baseUrl }
	} catch (error) {
		if (error instanceof SecretUnreadableError) return null
		throw error
	}
}

export async function getJevCredentials(): Promise<JevCredentials | null> {
	const cached = holder[CACHE]
	if (cached != null && Date.now() - cached.at < CACHE_MS) return cached.value
	const value = (await savedCredentials()) ?? serverCredentials()
	holder[CACHE] = { value, at: Date.now() }
	return value
}

export type JevConnectionStatus = {
	// Where runs get their key from now: the one saved in Settings, the
	// server's own, or nowhere (runs can't start).
	source: 'saved' | 'server' | 'none'
	// The saved connection, as Settings shows it: never the key itself.
	saved: {
		baseUrl: string
		keyLast4: string
		checkedAt: Date
		// Saved, but this server can't decrypt it, so it isn't being used.
		isUnreadable: boolean
	} | null
	// Whether this server can store a key at all (it has an encryption key).
	canSave: boolean
}

export async function getJevConnectionStatus(): Promise<JevConnectionStatus> {
	const key = encryptionKey()
	const row = await savedConnection()
	let isUnreadable = row != null
	if (row != null && key != null) {
		try {
			decryptSecret(row.keyCipher, key)
			isUnreadable = false
		} catch (error) {
			if (!(error instanceof SecretUnreadableError)) throw error
		}
	}
	const source =
		row != null && !isUnreadable ? 'saved' : serverCredentials() != null ? 'server' : 'none'
	return {
		source,
		saved:
			row == null
				? null
				: { baseUrl: row.baseUrl, keyLast4: row.keyLast4, checkedAt: row.checkedAt, isUnreadable },
		canSave: canSaveJevConnection()
	}
}

// Saves a key Jev has just accepted (jev-key-check.ts). The caller checks
// first and gates on settings.manage.
export async function saveJevConnection({
	apiKey,
	baseUrl,
	updatedById
}: JevCredentials & { updatedById: string }): Promise<void> {
	const key = encryptionKey()
	if (key == null) throw new Error('No encryption key: a Jev key cannot be saved')
	const data = {
		baseUrl,
		keyCipher: encryptSecret(apiKey, key),
		keyLast4: apiKey.slice(-LAST_CHARS),
		checkedAt: new Date(),
		updatedById
	}
	await db.jevConnection.upsert({
		where: { pool: env.RUN_WORKER_POOL },
		create: { pool: env.RUN_WORKER_POOL, ...data },
		update: data
	})
	delete holder[CACHE]
}

// Back to the server's own key, if it has one and isn't on-prem.
export async function removeJevConnection(): Promise<void> {
	await db.jevConnection.deleteMany({ where: { pool: env.RUN_WORKER_POOL } })
	delete holder[CACHE]
}
