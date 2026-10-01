import { cn } from '@/lib/cn'

export type GhostKind = 'list' | 'table'

const LIST_ROWS = 4
const TABLE_ROWS = 5

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
			{kind === 'table' && (
				<div className="border-border-input overflow-hidden rounded-lg border border-dashed">
					<div className="bg-surface-muted border-border text-text-muted type-overline grid grid-cols-4 gap-4 border-b px-4 py-2.5">
						{(headers ?? ['', '', '', '']).map((header, index) => (
							<span key={index} className="truncate">
								{header}
							</span>
						))}
					</div>
					{Array.from({ length: TABLE_ROWS }, (_, index) => (
						<div
							key={index}
							className="border-border grid h-11 grid-cols-4 items-center gap-4 border-b border-dashed px-4"
						>
							<Bar className="w-3/5" />
							<Bar className="w-4/5" />
							<Bar className="w-4/5" />
							<Bar className="w-2/5" />
						</div>
					))}
				</div>
			)}
		</div>
	)
}
