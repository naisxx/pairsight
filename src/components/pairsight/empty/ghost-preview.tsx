import { cn } from '@/lib/cn'

export type GhostKind = 'list' | 'table'

const LIST_ROWS = 4
const TABLE_ROWS = 5
const TABLE_COLUMNS = 4
// Placeholder cell widths, cycled across however many columns there are.
const CELL_WIDTHS = ['w-3/5', 'w-4/5', 'w-4/5', 'w-2/5']

function Bar({ className }: { className: string }) {
	return (
		<span
			className={cn(
				'bg-surface-muted border-border-input block h-2 rounded border border-dashed',
				className
			)}
		/>
	)
}

// A faint, dashed preview of what will appear here — the list or table the
// screen fills with once there's data. Purely decorative; it fades
// out downward so the message on top stays the focus.
export function GhostPreview({ kind, headers }: { kind: GhostKind; headers?: string[] }) {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000,transparent_92%)] p-4"
		>
			{kind === 'list' && (
				<div className="flex flex-col gap-2.5">
					{Array.from({ length: LIST_ROWS }, (_, index) => (
						<div
							key={index}
							className="border-border-input flex items-center gap-4 rounded-lg border border-dashed p-3.5"
						>
							<Bar className="flex-1" />
							<Bar className="w-1/5" />
							<Bar className="w-1/12" />
						</div>
					))}
				</div>
			)}
			{kind === 'table' && <TableGhost headers={headers} />}
		</div>
	)
}

// One column per header, so the ghost reads as the table it stands in for.
function TableGhost({ headers }: { headers?: string[] }) {
	const columns = headers ?? Array.from({ length: TABLE_COLUMNS }, () => '')
	const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }
	return (
		<div className="border-border-input overflow-hidden rounded-lg border border-dashed">
			<div
				style={grid}
				className="bg-surface-muted border-border text-text-muted type-overline grid gap-4 border-b px-4 py-2.5"
			>
				{columns.map((header, index) => (
					<span key={index} className="truncate">
						{header}
					</span>
				))}
			</div>
			{Array.from({ length: TABLE_ROWS }, (_, row) => (
				<div
					key={row}
					style={grid}
					className="border-border grid h-11 items-center gap-4 border-b border-dashed px-4"
				>
					{columns.map((_, index) => (
						<Bar key={index} className={CELL_WIDTHS[index % CELL_WIDTHS.length] ?? 'w-3/5'} />
					))}
				</div>
			))}
		</div>
	)
}
