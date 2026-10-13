import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AnalyticsProvider } from '@/lib/analytics/analytics-provider'
import { Toaster } from '@/components/ui/toaster'
import { NONCE_HEADER, THEME_DEFAULT_HEADER } from '@/lib/csp'
import '../globals.css'

// Variable fonts, self-hosted by next/font. Bricolage keeps its optical-size
// axis so globals.css can hold headlines at the open, small-size cut the
// design was drawn with.
const bricolage = Bricolage_Grotesque({
	subsets: ['latin'],
	axes: ['opsz'],
	variable: '--font-bricolage',
	display: 'swap'
})
const instrumentSans = Instrument_Sans({
	subsets: ['latin'],
	variable: '--font-instrument',
	display: 'swap'
})
const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-jetbrains-mono',
	display: 'swap'
})

export const metadata: Metadata = {
	title: { default: 'PairSight', template: '%s · PairSight' }
}

export default async function LocaleLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}) {
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) {
		notFound()
	}
	// The script policy (src/proxy.ts) blocks next-themes' inline script
	// without this request's nonce.
	const requestHeaders = await headers()
	const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined
	// The landing page is dark until someone picks a theme; everywhere else
	// follows the system setting (src/proxy.ts decides which this page is).
	const defaultTheme = requestHeaders.get(THEME_DEFAULT_HEADER) === 'dark' ? 'dark' : 'system'

	return (
		// next-themes writes data-theme on <html> before hydration.
		<html
			lang={locale}
			className={`${bricolage.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<body>
				<AnalyticsProvider />
				<ThemeProvider nonce={nonce} defaultTheme={defaultTheme}>
					<NextIntlClientProvider>
						<QueryProvider>{children}</QueryProvider>
						{/* Inside the messages: its Dismiss and actions are words too. */}
						<Toaster />
					</NextIntlClientProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
