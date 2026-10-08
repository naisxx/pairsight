import { getTranslations } from 'next-intl/server'
import { Skeleton } from '@/components/ui/skeleton'

// Loading states shaped like the page that's coming (docs/PairSight-UX-Plan.md
// §5): no spinner over a blank page, and no layout jump when it arrives.

const TILE_COUNT = 5
const TABLE_ROWS = 8
const FIELD_ROWS = 6

async function Loading({ children }: { children: React.ReactNode }) {
	const t = await getTranslations('Shell')
	return (
		<div role="status" aria-label={t('loading')} className="flex flex-1 flex-col">
			{children}
		</div>
	)
}

function HeaderSkeleton() {
	return (
		<div className="mb-6 flex flex-col gap-2">
			<Skeleton className="h-8 w-56" />
			<Skeleton className="h-5 w-full max-w-xl" />
		</div>
	)
}

export function RunSkeleton() {
	return (
		<Loading>
			<HeaderSkeleton />
			<div className="border-border bg-surface max-w-4xl rounded-lg border">
				<div className="flex flex-col gap-2 px-5 pt-5">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-4 w-72" />
				</div>
				<div className="flex flex-col gap-2 px-5 pt-4">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-2 w-full" />
				</div>
				<div className="border-border mt-4 grid grid-cols-2 border-t @2xl:grid-cols-4">
					{Array.from({ length: 4 }, (_, index) => (
						<div key={index} className="flex flex-col gap-2 px-5 py-3">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-6 w-10" />
						</div>
					))}
				</div>
			</div>
		</Loading>
	)
}

export function ResultsSkeleton() {
	return (
		<Loading>
			<HeaderSkeleton />
			<div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @6xl:grid-cols-5">
				{Array.from({ length: TILE_COUNT }, (_, index) => (
					<Skeleton key={index} className="h-24 rounded-lg" />
				))}
			</div>
			<Skeleton className="mt-4 h-5 w-full max-w-2xl" />
			<div className="mt-6 flex gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-8 w-32" />
			</div>
			<div className="border-border bg-surface mt-6 flex flex-col rounded-lg border">
				{Array.from({ length: TABLE_ROWS }, (_, index) => (
					<div key={index} className="border-border flex h-10 items-center gap-6 border-b px-4">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 w-20" />
					</div>
				))}
			</div>
		</Loading>
	)
}

export function PairSkeleton() {
	return (
		<Loading>
			<Skeleton className="mb-4 h-8 w-64" />
			<Skeleton className="mb-6 h-16 w-full rounded-lg" />
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 @6xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="border-border bg-surface flex flex-col rounded-lg border">
					{Array.from({ length: FIELD_ROWS }, (_, index) => (
						<div key={index} className="border-border flex h-11 items-center gap-6 border-b px-4">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</div>
				<div className="flex flex-col gap-4">
					<Skeleton className="h-40 rounded-lg" />
					<Skeleton className="h-24 rounded-lg" />
				</div>
			</div>
		</Loading>
	)
}
