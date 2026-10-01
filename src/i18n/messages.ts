import type { routing } from './routing'

// Each locale's messages file in messages/. Typed by the routing's locales, so
// adding a locale without naming its file fails typecheck;
// messages.test.mts checks every file exists and parses.
export const MESSAGE_FILES: Record<(typeof routing.locales)[number], string> = {
	en: 'en.json'
}
