import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { formats } from './formats'
import { MESSAGE_FILES } from './messages'
import { routing } from './routing'

// Messages are read from disk, never imported. As an import, `messages/*.json`
// became a module in Turbopack's graph, so the text a page showed depended on
// the bundler noticing every edit — and when it missed one (or restored an old
// copy from its on-disk cache after a restart), new code rendered old or
// missing copy as raw keys, on whichever screen had changed last. Reading the
// file takes the bundler out of it: in development every request reads what's
// on disk, so an edit shows on the next reload; in production the files can't
// change, so each is read once per server. next.config.ts traces `messages/`
// into the deployment, since nothing imports it.

const MESSAGES_DIR = path.join(process.cwd(), 'messages')
const isDevelopment = process.env.NODE_ENV === 'development'
const loaded = new Map<string, Promise<Record<string, unknown>>>()

async function readMessages(file: string): Promise<Record<string, unknown>> {
	const parsed: unknown = JSON.parse(await readFile(path.join(MESSAGES_DIR, file), 'utf8'))
	if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
		throw new Error(`messages/${file} must hold a JSON object`)
	}
	return Object.fromEntries(Object.entries(parsed))
}

function loadMessages(file: string) {
	if (isDevelopment) return readMessages(file)
	const cached = loaded.get(file) ?? readMessages(file)
	loaded.set(file, cached)
	return cached
}

export default getRequestConfig(async ({ requestLocale }) => {
	const requested = await requestLocale
	const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

	return {
		locale,
		messages: await loadMessages(MESSAGE_FILES[locale]),
		formats
	}
})
