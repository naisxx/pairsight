import type { Metadata } from 'next'
import { JetBrains_Mono, Poppins } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AnalyticsProvider } from '@/lib/analytics/analytics-provider'
import { Toaster } from '@/components/ui/toaster'
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
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) {
		notFound()
	}

	return (
		// next-themes writes the `dark` class on <html> before hydration.
		<html
			lang={locale}
			className={`${poppins.variable} ${jetbrainsMono.variable}`}
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
