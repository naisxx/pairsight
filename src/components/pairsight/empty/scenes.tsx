import { CheckIcon, PlusIcon, SwapIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { LogoGlyph } from '../wordmark'

// The drawn pictures above every empty state (empty-state.tsx): small scenes
// built from the product's own parts (record cards, file cards, score bars,
// category dots) in theme tokens, so they read the same in light and dark.
// Purely decorative: the EmptyState's title and text carry the meaning.
// Each part arrives with the shared `rise` stagger (motion.css).

const CHECK_SIZE = 10
const PLUS_SIZE = 14
const SWAP_SIZE = 18

// A placeholder line of text.
function Line({ width, className }: { width: string; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn('bg-border block h-1.5 rounded-full', className)}
			style={{ width }}
		/>
	)
}

// A record: a reference chip and a few lines of values.
function RecordCard({
	className,
	style,
	accent = false,
	index = 0
}: {
	className?: string
	style?: React.CSSProperties
	// The coral edge of a selected or current thing.
	accent?: boolean
	index?: number
}) {
	return (
		<span
			className={cn(
				`rise stagger-${index} border-border bg-surface-elevated absolute flex w-[92px] flex-col gap-1.5 rounded-md border p-2.5`,
				accent && 'shadow-[inset_2px_0_0_var(--action)]',
				className
			)}
			style={style}
		>
			<span className="bg-surface-muted text-text-muted w-fit rounded-[3px] px-1 font-mono text-[8px] leading-3">
				P00{index + 1}
			</span>
			<Line width="80%" className="bg-text-muted/40" />
			<Line width="60%" />
			<Line width="70%" />
		</span>
	)
}

// A file: a folded corner, a format label and a couple of lines.
function FileCard({
	className,
	style,
	index = 0,
	label = 'CSV'
}: {
	className?: string
	style?: React.CSSProperties
	index?: number
	label?: string
}) {
	return (
		<span
			className={cn(
				`rise stagger-${index} border-border bg-surface-elevated absolute flex h-[96px] w-[76px] flex-col rounded-md border p-2`,
				className
			)}
			style={style}
		>
			<span
				aria-hidden
				className="border-border bg-surface-muted absolute top-[-1px] right-[-1px] size-4 rounded-tr-md rounded-bl-md border"
			/>
			<span className="text-text-muted font-mono text-[8px] font-semibold tracking-wider">
				{label}
			</span>
			<span className="mt-auto flex flex-col gap-1.5">
				<Line width="100%" />
				<Line width="80%" />
				<Line width="90%" />
			</span>
		</span>
	)
}

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<span aria-hidden className={cn('relative block h-[132px] w-[240px]', className)}>
			{children}
		</span>
	)
}

// A soft disc behind a scene, so it sits on something.
function Halo() {
	return (
		<span
			className="bg-surface-muted absolute top-1/2 left-1/2 size-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full"
			aria-hidden
		/>
	)
}

function Badge({
	tone,
	children,
	className
}: {
	tone: 'brand' | 'success' | 'danger'
	children: React.ReactNode
	className?: string
}) {
	return (
		<span
			className={cn(
				'rise stagger-4 ring-bg absolute flex size-6 items-center justify-center rounded-full ring-4',
				tone === 'brand' && 'bg-action text-action-ink',
				tone === 'success' && 'bg-success text-surface',
				tone === 'danger' && 'bg-danger text-surface',
				className
			)}
		>
			{children}
		</span>
	)
}

// No vendors yet: one vendor file in place, an empty slot beside it.
export function NoVendorsScene() {
	return (
		<Frame>
			<Halo />
			<FileCard index={0} className="top-[18px] left-[56px] -rotate-6" />
			<span className="rise stagger-1 border-border-input bg-surface text-text-muted absolute top-[18px] left-[120px] flex h-[96px] w-[76px] rotate-3 items-center justify-center rounded-md border-2 border-dashed">
				<PlusIcon size={PLUS_SIZE} />
			</span>
			<Badge tone="brand" className="top-[8px] left-[46px]">
				<CheckIcon size={CHECK_SIZE} variant="bold" />
			</Badge>
		</Frame>
	)
}

// No records yet: a file on its way into an empty table.
export function DropScene() {
	return (
		<Frame>
			<span className="rise stagger-0 border-border bg-surface absolute top-[34px] left-[40px] flex w-[160px] flex-col gap-2 rounded-md border border-dashed p-3">
				{[0, 1, 2, 3].map((row) => (
					<span key={row} className="flex gap-2">
						<Line width="22%" className={row === 0 ? 'bg-text-muted/40' : undefined} />
						<Line width="38%" className={row === 0 ? 'bg-text-muted/40' : undefined} />
						<Line width="26%" className={row === 0 ? 'bg-text-muted/40' : undefined} />
					</span>
				))}
			</span>
			<FileCard
				index={2}
				label="XLSX"
				className="empty-drift top-[2px] left-[150px] h-[72px] w-[58px] rotate-6 shadow-[inset_0_2px_0_var(--action)]"
			/>
		</Frame>
	)
}

// No pairs match the filters: a funnel over empty rows.
export function NoMatchesScene() {
	return (
		<Frame>
			<span
				className="rise stagger-0 bg-border absolute top-[10px] left-[70px] h-[44px] w-[100px]"
				style={{ clipPath: 'polygon(0 0, 100% 0, 62% 100%, 38% 100%)' }}
			/>
			<span className="rise stagger-1 bg-action absolute top-[54px] left-[114px] h-[14px] w-[12px] rounded-b-sm" />
			{[0, 1, 2].map((row) => (
				<span
					key={row}
					className={`rise stagger-${row + 2} border-border-input absolute left-[50px] h-[14px] w-[140px] rounded-sm border border-dashed`}
					style={{ top: `${78 + row * 18}px` }}
				/>
			))}
		</Frame>
	)
}

// Nothing running: an idle queue, its bars waiting at the start.
export function IdleScene() {
	return (
		<Frame>
			<Halo />
			{[0, 1, 2].map((row) => (
				<span
					key={row}
					className={`rise stagger-${row} border-border bg-surface-elevated absolute left-[48px] flex h-[28px] w-[144px] items-center gap-2 rounded-md border px-2.5`}
					style={{ top: `${18 + row * 34}px`, opacity: 1 - row * 0.25 }}
				>
					<span className="border-border-input size-2.5 shrink-0 rounded-full border" />
					<span className="bg-border relative h-1.5 flex-1 rounded-full">
						<span className="bg-text-muted/50 absolute inset-y-0 left-0 w-[6%] rounded-full" />
					</span>
				</span>
			))}
		</Frame>
	)
}

// No finished runs: a stack of run cards, the top one still going.
export function RunsStackScene() {
	return (
		<Frame>
			<Halo />
			{[2, 1, 0].map((layer) => (
				<span
					key={layer}
					className={`rise stagger-${2 - layer} border-border bg-surface-elevated absolute flex h-[64px] w-[150px] flex-col justify-between rounded-md border p-2.5`}
					style={{
						top: `${26 + layer * -10}px`,
						left: `${45 + layer * 8}px`,
						opacity: 1 - layer * 0.3
					}}
				>
					<span className="flex items-center gap-1.5">
						<LogoGlyph className="h-2.5 w-[14px]" />
						<Line width="50%" />
					</span>
					<span className="bg-border relative h-1.5 rounded-full">
						{layer === 0 && (
							<span className="score-fill bg-action absolute inset-y-0 left-0 w-[62%] rounded-full" />
						)}
					</span>
				</span>
			))}
		</Frame>
	)
}

// All caught up: a neat stack of checked pairs.
export function CaughtUpScene() {
	return (
		<Frame>
			<Halo />
			{[0, 1, 2].map((row) => (
				<span
					key={row}
					className={`rise stagger-${row} border-border bg-surface-elevated absolute left-[60px] flex h-[24px] w-[120px] items-center gap-2 rounded-md border px-2`}
					style={{ top: `${24 + row * 30}px` }}
				>
					<span className="bg-cat-both size-2 shrink-0 rounded-full" />
					<Line width="60%" />
				</span>
			))}
			<Badge tone="success" className="top-[12px] left-[168px]">
				<CheckIcon size={CHECK_SIZE} variant="bold" />
			</Badge>
		</Frame>
	)
}

// Page not found: two records drifting apart, the line between them broken.
export function LostScene() {
	return (
		<Frame>
			<Halo />
			<RecordCard index={0} className="empty-drift top-[22px] left-[16px] -rotate-6" />
			<RecordCard
				index={1}
				accent
				className="empty-drift-reverse top-[34px] left-[132px] rotate-6"
			/>
			<span className="rise stagger-2 absolute top-[64px] left-[108px] flex gap-1">
				<span className="bg-border-input h-[2px] w-[6px] rounded-full" />
				<span className="bg-border-input h-[2px] w-[6px] rounded-full" />
			</span>
		</Frame>
	)
}

// Something went wrong: a pair whose connection came apart.
export function UnpluggedScene() {
	return (
		<Frame>
			<Halo />
			<RecordCard index={0} className="top-[28px] left-[20px]" />
			<RecordCard index={1} className="top-[28px] left-[128px]" />
			<span className="rise stagger-2 bg-border-input absolute top-[62px] left-[110px] h-[2px] w-[6px] rounded-full" />
			<span className="rise stagger-2 bg-border-input absolute top-[62px] left-[122px] h-[2px] w-[6px] rounded-full" />
			<Badge tone="danger" className="top-[14px] left-[108px] text-[11px] font-bold">
				!
			</Badge>
		</Frame>
	)
}

// The Results verdict's picture: two records side by side, weighed against
// each other.
export function ComparisonScene() {
	return (
		<Frame className="h-[150px] w-[260px]">
			<RecordCard
				index={0}
				className="empty-drift top-[18px] left-[20px] w-[120px] -rotate-6 p-3"
			/>
			<RecordCard
				index={1}
				accent
				className="empty-drift-reverse top-[30px] left-[118px] w-[120px] rotate-6 p-3"
			/>
			<span className="rise stagger-3 bg-action text-action-ink ring-surface/60 absolute top-[56px] left-[110px] flex size-10 items-center justify-center rounded-full ring-8">
				<SwapIcon size={SWAP_SIZE} />
			</span>
		</Frame>
	)
}
