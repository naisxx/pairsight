import { Reveal } from '@/components/ui/reveal'
import type { Category } from '@/lib/pairsight/decisions'
import type { EntityType } from '@/lib/pairsight/entity-types'
import type { StatsRow } from '@/lib/pairsight/stats'
import type { ResultsOverview as OverviewData } from '@/server/pairsight/result-overview'
import { CoveragePanel } from './coverage-panel'
import { HeadToHead } from './head-to-head'
import { LookFirst } from './look-first'
import { ThresholdSensitivity } from './threshold-sensitivity'
import { WhyTheyDisagree } from './why-they-disagree'

type Href = { pathname: string; query: Record<string, string> }

const asString = (href: Href) => `${href.pathname}?${new URLSearchParams(href.query)}`

// The Overview tab (docs/PairSight-UX-Plan.md §4.1), kept to what answers
// "which vendor, and where do I look?": the vendors head to head, where to
// look first, what Jev checked, how the cut-off holds, and why they disagree.
// Panels enter in a short stagger.
export function ResultsOverview({
	overview,
	vendorName,
	vendorId,
	entityType,
	threshold,
	detailed,
	categoryHrefs,
	statsByVendor,
	pairHref,
	vendorHrefs
}: {
	overview: OverviewData
	vendorName: string
	vendorId: string
	entityType: EntityType
	threshold: number
	// The detailed view with some filters set (the rest cleared).
	detailed: (query: Record<string, string>) => Href
	// Each vendor's pairs in each group, in the detailed view.
	categoryHrefs: Record<string, Partial<Record<Category | 'incomplete', string>>>
	// Each vendor's counts by score, for the cut-off preview.
	statsByVendor: Record<string, StatsRow[]>
	pairHref: (pairId: string) => Href
	vendorHrefs: Record<string, string>
}) {
	let index = 0

	return (
		<div className="mt-6 flex flex-col gap-4">
			<Reveal index={index++}>
				<HeadToHead
					vendors={overview.byVendor}
					selectedId={vendorId}
					vendorHrefs={vendorHrefs}
					categoryHrefs={categoryHrefs}
					statsByVendor={statsByVendor}
					runThreshold={threshold}
				/>
			</Reveal>

			<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
				<Reveal index={index++} className="@5xl:col-span-7">
					<LookFirst
						vendorName={vendorName}
						threshold={threshold}
						missed={overview.top.missed}
						merges={overview.top.merges}
						workload={overview.workload}
						hrefs={{
							disagreements: asString(detailed({ category: 'disagreements' })),
							near: asString(detailed({ score: 'near' })),
							incomplete: asString(detailed({ category: 'incomplete' }))
						}}
						pairHref={pairHref}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="@5xl:col-span-5">
					<CoveragePanel
						coverage={overview.coverage}
						suggestedType={overview.coverage.suggested > 0 ? entityType : null}
						className="h-full"
					/>
				</Reveal>
			</div>

			<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
				<Reveal index={index++} className="@5xl:col-span-7">
					<ThresholdSensitivity
						vendorName={vendorName}
						threshold={threshold}
						metrics={overview.metrics}
						points={overview.sensitivity}
						stableRange={overview.stableRange}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="@5xl:col-span-5">
					<WhyTheyDisagree
						vendorName={vendorName}
						patterns={overview.fieldPatterns}
						className="h-full"
					/>
				</Reveal>
			</div>
		</div>
	)
}
