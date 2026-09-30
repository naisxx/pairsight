'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// Class-based so the Light / Dark / System menu can override the OS setting;
// next-themes injects the blocking script that sets `.dark` before paint, so
// there is no light flash on a dark preference.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			{children}
		</NextThemesProvider>
	)
}
