import { getTranslations } from 'next-intl/server'
import { Skeleton } from '@/components/ui/skeleton'

// Loading states shaped like the page that's coming (docs/PairSight-UX-Plan.md
// §5): no spinner over a blank page, and no layout jump when it arrives.
// Still grey shapes: inside the product nothing loops.

const VENDOR_CARDS = 2
// The mosaic's 22 columns (mosaic.tsx), a dozen rows deep.
const MOSAIC_TILES = 22 * 12
const MEASURE_ROWS = 5
const FIELD_ROWS = 8

const CARD = 'bg-surface border-border min-w-0 rounded-lg border'

async function Loading({ children }: { children: React.ReactNode }) {
	const t = await getTranslations('Shell')
	return (
		<div role="status" aria-label={t('loading')} className="flex flex-1 flex-col">
			{children}
		</div>
	)
}

// Results: the run's line, the two-line verdict, each vendor's mosaic, and
// the measures under them.
export function ResultsSkeleton() {
	return (
		<Loading>
			<Skeleton className="h-4 w-full max-w-[520px]" />
			<Skeleton className="mt-5 h-11 w-full max-w-[720px]" />
			<Skeleton className="mt-2 h-11 w-full max-w-[600px]" />
			<Skeleton className="mt-5 h-4 w-full max-w-[480px]" />
			<div className="mt-9 flex flex-wrap gap-4">
				{Array.from({ length: VENDOR_CARDS }, (_, card) => (
					<div key={card} className={`${CARD} flex-[1_1_420px] p-6`}>
						<div className="flex items-center justify-between gap-4">
							<Skeleton className="h-6 w-40" />
							<Skeleton className="h-9 w-28" />
						</div>
						<div className="mt-6 grid grid-cols-22 gap-[3px]">
							{Array.from({ length: MOSAIC_TILES }, (_, tile) => (
								<Skeleton key={tile} className="aspect-square rounded-xs" />
							))}
						</div>
						<Skeleton className="mt-4 h-4 w-3/4" />
					</div>
				))}
			</div>
			<div className={`${CARD} mt-4 px-6 py-3`}>
				{Array.from({ length: MEASURE_ROWS }, (_, row) => (
					<div
						key={row}
						className="border-border flex items-center gap-6 border-b py-4 last:border-b-0"
					>
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-3 w-64 max-w-full" />
						</div>
						<Skeleton className="h-5 w-20" />
						<Skeleton className="h-5 w-20" />
					</div>
				))}
			</div>
		</Loading>
	)
}

// A pair: the way back and the steppers, the pair's references and names,
// the verdict bar, the field-by-field table and the two cards beside it.
export function PairSkeleton() {
	return (
		<Loading>
			<div className="flex items-center justify-between gap-4">
				<Skeleton className="h-6 w-32" />
				<div className="flex gap-3">
					<Skeleton className="h-11 w-28 rounded-md" />
					<Skeleton className="h-11 w-24 rounded-md" />
				</div>
			</div>
			<Skeleton className="mt-9 h-4 w-64" />
			<Skeleton className="mt-4 h-12 w-full max-w-[720px]" />
			<Skeleton className="mt-7 h-24 w-full rounded-lg" />
			<div className="mt-9 flex flex-wrap items-start gap-4">
				<div className={`${CARD} flex-[2_1_560px] px-7 py-6`}>
					<Skeleton className="h-7 w-72 max-w-full" />
					<div className="mt-6">
						{Array.from({ length: FIELD_ROWS }, (_, row) => (
							<div key={row} className="border-border flex h-14 items-center gap-6 border-t">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-4 flex-1" />
								<Skeleton className="size-6" />
								<Skeleton className="h-4 flex-1" />
							</div>
						))}
					</div>
				</div>
				<div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
					<div className={`${CARD} flex flex-col gap-3 p-7`}>
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-5 w-full" />
						<Skeleton className="mt-3 h-2 w-full rounded-full" />
						<Skeleton className="mt-3 h-4 w-4/5" />
					</div>
					<div className={`${CARD} flex flex-col gap-3 p-7`}>
						<Skeleton className="h-3 w-40" />
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-3/4" />
					</div>
				</div>
			</div>
		</Loading>
	)
}
