import type { Metadata } from 'next'
import { JetBrains_Mono, Poppins } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AnalyticsProvider } from '@/lib/analytics/analytics-provider'
import { Toaster } from '@/components/ui/toaster'
import { parseUiStyle, UI_STYLE_COOKIE } from '@/lib/ui-style'
import '../globals.css'

// Poppins isn't a variable font, so each weight the type scale uses is loaded
// explicitly (globals.css, "The type scale").
const poppins = Poppins({
	subsets: ['latin'],
	weight: ['400', '500', '600'],
	variable: '--font-poppins',
	display: 'swap'
})
const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-jetbrains-mono',
	display: 'swap'
})

export const metadata: Metadata = {
	title: 'PairSight'
}

export default async function LocaleLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}) {
	const [{ locale }, cookieStore] = await Promise.all([params, cookies()])
	if (!hasLocale(routing.locales, locale)) {
		notFound()
	}
	// Classic or Glass (src/lib/ui-style.ts), from the cookie, so the first
	// paint is already in the chosen style.
	const uiStyle = parseUiStyle(cookieStore.get(UI_STYLE_COOKIE)?.value)

	return (
		// next-themes writes the `dark` class on <html> before hydration.
		<html
			lang={locale}
			className={`${poppins.variable} ${jetbrainsMono.variable}`}
			data-ui={uiStyle}
			suppressHydrationWarning
		>
			<body>
				<AnalyticsProvider />
				<ThemeProvider>
					<NextIntlClientProvider>
						<QueryProvider>{children}</QueryProvider>
					</NextIntlClientProvider>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	)
}
