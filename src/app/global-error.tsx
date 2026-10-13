'use client'

import { useEffect } from 'react'
import { captureClientError } from '@/lib/observability/capture-client-error'
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/errors/chunk-load-error'

// Replaces the ENTIRE app (including the [locale] root layout) when an
// error escapes even that layout, so it must render its own <html>/<body>
// and can't rely on globals.css having loaded — hence the inline styles and
// hardcoded colors below instead of Tailwind classes/design tokens. This is
// the one deliberate exception to "no hardcoded hex" in DESIGN.md; every
// other error UI goes through src/components/error-page.tsx and the real
// tokens. Values here are copied from the light-mode tokens in
// src/app/globals.css — keep them in sync if those change.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	useEffect(() => {
		if (isChunkLoadError(error)) {
			reloadOnceForChunkError()
			return
		}
		captureClientError(error, { digest: error.digest, boundary: 'global-error' })
	}, [error])

	if (isChunkLoadError(error)) return null

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					backgroundColor: '#f7f6f3',
					color: '#0d0d0e',
					fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
				}}
			>
				<main
					style={{
						display: 'flex',
						minHeight: '100vh',
						flexDirection: 'column',
						justifyContent: 'center',
						boxSizing: 'border-box',
						maxWidth: '36rem',
						margin: '0 auto',
						padding: '4rem 1rem'
					}}
				>
					<h1
						style={{
							fontSize: '2.75rem',
							lineHeight: 1.05,
							fontWeight: 600,
							letterSpacing: '-0.025em',
							margin: 0
						}}
					>
						Something went wrong
					</h1>
					<p style={{ fontSize: '1rem', lineHeight: 1.5, color: '#3d3d40', margin: '0.75rem 0 0' }}>
						We hit a snag loading the app. We&apos;ve been notified — reloading usually fixes it.
					</p>
					<div style={{ marginTop: '2rem' }}>
						<button
							onClick={() => window.location.reload()}
							style={{
								height: '2.75rem',
								borderRadius: '12px',
								backgroundColor: '#ff4a1c',
								color: '#0d0d0e',
								padding: '0 1.125rem',
								fontSize: '0.9375rem',
								fontWeight: 600,
								border: 'none',
								cursor: 'pointer'
							}}
						>
							Reload
						</button>
					</div>
					{error.digest && (
						<p
							style={{
								fontFamily: 'ui-monospace, Menlo, monospace',
								fontSize: '0.875rem',
								color: '#66666b',
								margin: '1.5rem 0 0'
							}}
						>
							Reference: <code>{error.digest}</code>
						</p>
					)}
				</main>
			</body>
		</html>
	)
}
