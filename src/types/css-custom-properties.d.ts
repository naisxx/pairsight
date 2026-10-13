import 'react'

// Lets `style` set CSS custom properties (`--d`, `--from`) the stylesheet
// reads, typed, without a cast at each use.
declare module 'react' {
	interface CSSProperties {
		[property: `--${string}`]: string | number | undefined
	}
}
