import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/reveal'
import type { Category } from '@/lib/pairsight/decisions'
import type { ResultsOverview as OverviewData } from '@/server/pairsight/result-overview'
import { CategorySummary } from './category-summary'
import { CoveragePanel } from './coverage-panel'
import { DecisionMatrix } from './decision-matrix'
import { FieldPatternsPanel } from './field-patterns'
import { MetricStrip } from './metric-strip'
import { ScoreDistribution } from './score-distribution'
import { SourceBreakdown } from './source-breakdown'
import { ThresholdSensitivity } from './threshold-sensitivity'
import { TopDisagreements } from './top-disagreements'
import { VendorComparison } from './vendor-comparison'
import { VendorOverlap } from './vendor-overlap'
import { WorkloadPanel } from './workload-panel'

type Href = { pathname: string; query: Record<string, string> }

function SectionTitle({ title, hint }: { title: string; hint: string }) {
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-2 pt-4">
			<h2 className="text-text text-[0.9375rem] font-semibold">{title}</h2>
			<p className="text-text-muted text-xs">{hint}</p>
		</div>
	)
}

// The Overview tab (docs/PairSight-UX-Plan.md §4.1): the vendor's metrics and
// coverage, the categories, how decisions line up and hold up, how vendors
// compare, and where to look first. Panels enter in a short stagger.
export function ResultsOverview({
	overview,
	vendorName,
	vendorId,
	threshold,
	ruleLabels,
	detailed,
	pairHref,
	vendorHrefs
}: {
	overview: OverviewData
	vendorName: string
	vendorId: string
	threshold: number
	ruleLabels: Record<string, string>
	// The detailed view with some filters set (the rest cleared).
	detailed: (query: Record<string, string>) => Href
	pairHref: (pairId: string) => Href
	vendorHrefs: Record<string, string>
}) {
	const t = useTranslations('Overview')
	const asString = (href: Href) => `${href.pathname}?${new URLSearchParams(href.query)}`
	const categoryHrefs: Record<Category, string> = {
		both_matched: asString(detailed({ category: 'both_matched' })),
		pairsight_only: asString(detailed({ category: 'pairsight_only' })),
		vendor_only: asString(detailed({ category: 'vendor_only' })),
		neither_matched: asString(detailed({ category: 'neither_matched' }))
	}
	const others = overview.byVendor.filter((vendor) => vendor.id !== vendorId)
	const overlap = overview.overlap
	const [firstOverlap, secondOverlap] = overlap?.vendors ?? []
	let index = 0

	return (
		<div className="mt-6 flex flex-col gap-4">
			<div className="grid gap-4 lg:grid-cols-12">
				<Reveal index={index++} className="lg:col-span-8">
					<MetricStrip
						vendorName={vendorName}
						metrics={overview.metrics}
						others={others}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="lg:col-span-4 lg:row-span-2">
					<CoveragePanel coverage={overview.coverage} className="h-full" />
				</Reveal>
				<Reveal index={index++} className="lg:col-span-8">
					<CategorySummary
						vendorName={vendorName}
						metrics={overview.metrics}
						pairsHref={(category) => detailed({ category })}
					/>
				</Reveal>
			</div>

			<SectionTitle title={t('sectionDecisions')} hint={t('sectionDecisionsHint')} />
			<div className="grid gap-4 lg:grid-cols-12">
				<Reveal index={index++} className="lg:col-span-7">
					<ThresholdSensitivity
						vendorName={vendorName}
						threshold={threshold}
						metrics={overview.metrics}
						points={overview.sensitivity}
						stableRange={overview.stableRange}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="lg:col-span-5">
					<DecisionMatrix
						vendorName={vendorName}
						counts={overview.metrics.counts}
						assessed={overview.metrics.assessed}
						categoryHrefs={categoryHrefs}
						className="h-full"
					/>
				</Reveal>
			</div>
			{overview.byVendor.length > 1 && (
				<div className="grid gap-4 lg:grid-cols-12">
					<Reveal index={index++} className="lg:col-span-7">
						<VendorComparison
							vendors={overview.byVendor.map((vendor) => ({
								...vendor,
								href: vendorHrefs[vendor.id] ?? ''
							}))}
							selectedId={vendorId}
							className="h-full"
						/>
					</Reveal>
					{overlap != null && firstOverlap != null && secondOverlap != null && (
						<Reveal index={index++} className="lg:col-span-5">
							<VendorOverlap
								first={firstOverlap.name}
								second={secondOverlap.name}
								groups={overlap.groups}
								className="h-full"
							/>
						</Reveal>
					)}
				</div>
			)}

			<SectionTitle title={t('sectionDisagreements')} hint={t('sectionDisagreementsHint')} />
			<div className="grid gap-4 lg:grid-cols-12">
				<Reveal index={index++} className="lg:col-span-7">
					<FieldPatternsPanel
						vendorName={vendorName}
						patterns={overview.fieldPatterns}
						categoryHrefs={categoryHrefs}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="lg:col-span-5">
					<TopDisagreements
						vendorName={vendorName}
						threshold={threshold}
						missed={overview.top.missed}
						merges={overview.top.merges}
						pairHref={pairHref}
						className="h-full"
					/>
				</Reveal>
			</div>
			<div className="grid gap-4 lg:grid-cols-12">
				<Reveal index={index++} className="lg:col-span-5">
					<ScoreDistribution
						vendorName={vendorName}
						threshold={threshold}
						assessed={overview.metrics.assessed}
						bins={overview.histogram}
						rangeHrefs={overview.histogram.map((bin) =>
							asString(detailed({ score: `r:${bin.from.toFixed(1)}-${bin.to.toFixed(1)}` }))
						)}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="lg:col-span-4">
					<SourceBreakdown
						sources={overview.sources}
						ruleLabels={ruleLabels}
						sourceHrefs={{
							rules: asString(detailed({ source: 'rules' })),
							vendor: asString(detailed({ source: 'vendor' }))
						}}
						className="h-full"
					/>
				</Reveal>
				<Reveal index={index++} className="lg:col-span-3">
					<WorkloadPanel
						vendorName={vendorName}
						workload={overview.workload}
						hrefs={{
							disagreements: asString(detailed({ category: 'disagreements' })),
							near: asString(detailed({ score: 'near' })),
							incomplete: asString(detailed({ category: 'incomplete' }))
						}}
						className="h-full"
					/>
				</Reveal>
			</div>
		</div>
	)
}
