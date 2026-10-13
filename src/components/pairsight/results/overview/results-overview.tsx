import { Reveal } from '@/components/ui/reveal'
import type { Category } from '@/lib/pairsight/decisions'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { rankVendors } from '@/lib/pairsight/ranking'
import type { StatsRow } from '@/lib/pairsight/stats'
import type { ResultsOverview as OverviewData } from '@/server/pairsight/result-overview'
import { CoveragePanel } from './coverage-panel'
import { HeadToHead } from './head-to-head'
import { LookFirst } from './look-first'
import { ThresholdSensitivity } from './threshold-sensitivity'
import { VendorSwitch } from './vendor-switch'
import { WhyTheyDisagree } from './why-they-disagree'

type Href = { pathname: string; query: Record<string, string> }

const asString = (href: Href) => `${href.pathname}?${new URLSearchParams(href.query)}`

// The Overview tab (docs/PairSight-UX-Plan.md §4.1, pairsight-handoff
// Results), kept to what answers "which vendor, and where do I look?": the
// vendors head to head, then where to look first beside how the cut-off
// holds and what Jev checked, and why they disagree. With more than one
// vendor, a switch between the two says which vendor the panels below are
// about. Panels enter in a short stagger.
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
	// Colours follow the upload order; the switch lists the best first.
	const switchVendors = rankVendors(overview.byVendor).map((vendor) => ({
		id: vendor.id,
		name: vendor.name,
		colour: Math.max(
			0,
			overview.byVendor.findIndex((each) => each.id === vendor.id)
		)
	}))

	return (
		<div className="mt-10 flex flex-col gap-4">
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

			{switchVendors.length > 1 && (
				<Reveal index={index++}>
					<VendorSwitch vendors={switchVendors} selectedId={vendorId} hrefs={vendorHrefs} />
				</Reveal>
			)}

			<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
				<Reveal index={index++}>
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
				<div className="flex flex-col gap-4">
					<Reveal index={index++}>
						<ThresholdSensitivity
							vendorName={vendorName}
							threshold={threshold}
							metrics={overview.metrics}
							points={overview.sensitivity}
							stableRange={overview.stableRange}
						/>
					</Reveal>
					<Reveal index={index++}>
						<CoveragePanel
							coverage={overview.coverage}
							suggestedType={overview.coverage.suggested > 0 ? entityType : null}
						/>
					</Reveal>
				</div>
			</div>

			<Reveal index={index++}>
				<WhyTheyDisagree vendorName={vendorName} patterns={overview.fieldPatterns} />
			</Reveal>
		</div>
	)
}
