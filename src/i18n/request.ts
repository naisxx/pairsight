import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

// One static import per locale, not a template-string import
// (`import(\`../../messages/${locale}.json\`)`): Turbopack treats a template
// import as a context it doesn't reliably invalidate, so edited messages kept
// rendering stale (or as raw keys) in a running dev server and from its
// on-disk cache. A literal path is an ordinary tracked dependency. Typed by
// the routing's locales, so adding a locale without its messages file fails
// typecheck instead of falling back silently.
const MESSAGES: Record<(typeof routing.locales)[number], () => Promise<{ default: object }>> = {
	en: () => import('../../messages/en.json')
}

export default getRequestConfig(async ({ requestLocale }) => {
	const requested = await requestLocale
	const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

	return {
		locale,
		messages: (await MESSAGES[locale]()).default
	}
})
