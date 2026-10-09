'use client'

import { useSyncExternalStore } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

function noSubscription() {
	return () => {}
}

// Rendered on the client without the server's HTML first (a not-found page
// after a client navigation): React never runs a script it creates there,
// and warns about it. The theme is already set by then, so the script goes
// in as inert data instead. Hydration reads the server snapshot, so the tag
// still matches the server's, which ran before paint.
const INERT_SCRIPT = { type: 'application/json' }

// Class-based so the Light / Dark / System menu can override the OS setting;
// next-themes injects the blocking script that sets `.dark` before paint, so
// there is no light flash on a dark preference.
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
	const isClientRender = useSyncExternalStore(
		noSubscription,
		() => true,
		() => false
	)
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			nonce={nonce}
			scriptProps={isClientRender ? INERT_SCRIPT : undefined}
		>
			{children}
		</NextThemesProvider>
	)
}
