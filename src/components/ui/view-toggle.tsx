'use client'

import { ChartIcon, TableIcon } from './icons'
import { Tip } from './tooltip'

export type ChartView = 'chart' | 'table'

// Switches a chart to the same numbers as a table, and back. The table is
// also what makes each chart readable without seeing it.
export function ViewToggle({
	view,
	onChange,
	labels
}: {
	view: ChartView
	onChange: (view: ChartView) => void
	labels: { showTable: string; showChart: string }
}) {
	const label = view === 'chart' ? labels.showTable : labels.showChart
	return (
		<Tip content={label}>
			<button
				type="button"
				onClick={() => onChange(view === 'chart' ? 'table' : 'chart')}
				aria-label={label}
				aria-pressed={view === 'table'}
				className="hit-area text-text-muted hover:bg-surface-hover hover:text-text inline-flex size-7 items-center justify-center rounded-sm transition-colors duration-150"
			>
				{view === 'chart' ? <TableIcon /> : <ChartIcon />}
			</button>
		</Tip>
	)
}
