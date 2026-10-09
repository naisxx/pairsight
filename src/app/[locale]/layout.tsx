import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AnalyticsProvider } from '@/lib/analytics/analytics-provider'
import { Toaster } from '@/components/ui/toaster'
import { NONCE_HEADER } from '@/lib/csp'
import '../globals.css'

// A variable font: every weight the type scale uses (400–700) comes in one file.
const spaceGrotesk = Space_Grotesk({
	subsets: ['latin'],
	variable: '--font-space-grotesk',
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
	const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

	return (
		// next-themes writes the `dark` class on <html> before hydration.
		<html
			lang={locale}
			className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<body>
				<AnalyticsProvider />
				<ThemeProvider nonce={nonce}>
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
