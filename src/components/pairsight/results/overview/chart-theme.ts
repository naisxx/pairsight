// Shared Recharts styling so every chart reads as one system: muted mono
// ticks, hairline grid, the design's series colours (DESIGN.md §2).

export const AXIS_TICK = {
	fill: 'var(--text-muted)',
	fontSize: 11,
	fontFamily: 'var(--font-mono)'
} as const

export const GRID_STROKE = 'var(--border)'
export const SERIES_A = 'var(--series-a)'
export const SERIES_B = 'var(--series-b)'
export const MUTED_SERIES = 'var(--text-muted)'
export const THRESHOLD_STROKE = 'var(--ring)'

// Charts draw once, briefly: enough to read as a change, not a performance.
export const CHART_ANIMATION_MS = 300

const PERCENT = 100

// 0–1 share as "80.0%"; the empty label when there's nothing to divide by.
export function formatShare(value: number | null, emptyLabel: string): string {
	return value == null ? emptyLabel : `${(value * PERCENT).toFixed(1)}%`
}
