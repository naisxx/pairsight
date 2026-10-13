import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ArrowRightIcon, CloseIcon } from '@/components/ui/icons'
import { EmptyState } from '@/components/pairsight/empty-state'
import { NoMatchesScene } from '@/components/pairsight/empty/scenes'
import type { Category } from '@/lib/pairsight/decisions'
import { ShortcutsDialog } from '@/components/pairsight/results/shortcuts-dialog'
import { ResultsOverview } from '@/components/pairsight/results/overview/results-overview'
import { Pagination } from '@/components/pairsight/results/pagination'
import { PairFilters } from '@/components/pairsight/results/pair-filters'
import { PairsTable } from '@/components/pairsight/results/pairs-table'
import { CUTOFF_OPEN_PARAM, hasActiveFilters, toQuery } from '@/components/pairsight/results/query'
import { ResultsKeyboard } from '@/components/pairsight/results/results-keyboard'
import { ResultsTabs } from '@/components/pairsight/results/results-tabs'
import { RunStatusChip } from '@/components/pairsight/results/run-status-chip'
import { ExportMenu } from '@/components/pairsight/results/export-menu'
import { RunSwitcher } from '@/components/pairsight/results/run-switcher'
import { CutoffBar } from '@/components/pairsight/results/cutoff-bar'
import { CutoffPreviewProvider } from '@/components/pairsight/results/cutoff-preview'
import { Verdict } from '@/components/pairsight/results/verdict'
import { RunNotFinished } from '@/components/pairsight/results/run-not-finished'
import { Dock } from '@/components/pairsight/shell/dock'
import {
	getPairPanel,
	getRunResults,
	parseResultFilters,
	type ResultFilters
} from '@/server/pairsight/results'
import { isUuid } from '@/server/pairsight/schemas'
import type { EvaluationScope } from '@/server/pairsight/scope'
import { PairPanel } from '@/components/pairsight/results/pair-panel'
import { PairSelection } from '@/components/pairsight/results/pair-selection'
import { getRunProgress } from '@/server/pairsight/runs'
import { rankVendors } from '@/lib/pairsight/ranking'
import { runBase } from '@/lib/pairsight/evaluation-view'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import type { LoadedWorkspace, loadRun } from '@/server/pairsight/evaluation-pages'

// Results (docs/PairSight-UX-Plan.md §4.1, pairsight-handoff Results): the
// run in one line, the cut-off preview, then the Overview or the Pairs, with
// Overview, Pairs and Download in the dock. Everything that changes the view
// is in the URL, so it's shareable and Back works.
export async function ResultsScreen({
	loaded,
	workspace,
	rawFilters
}: {
	loaded: Awaited<ReturnType<typeof loadRun>>
	workspace: LoadedWorkspace['workspace']
	rawFilters: Record<string, string | string[] | undefined>
}) {
	const { scope, base, view } = loaded
	const runId = loaded.run.id
	const [t, format] = await Promise.all([getTranslations('Results'), getFormatter()])

	// Not finished (running, paused or stopped): how far it got, no numbers.
	if (loaded.run.status !== 'completed') {
		const progress = await getRunProgress(runId)
		const last = workspace.runs.find(
			(candidate) => candidate.status === 'completed' && candidate.id !== runId
		)
		return (
			<>
				<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
						<RunStatusChip status={loaded.run.status} />
						<p className="text-text-muted font-mono text-sm">
							{t.rich('notFinishedMeta', {
								number: loaded.run.number,
								date: format.dateTime(loaded.run.createdAt, {
									dateStyle: 'medium',
									timeStyle: 'short'
								}),
								model: loaded.run.jevModel,
								threshold: loaded.run.threshold.toFixed(2),
								n: (chunks) => <span className="text-text">{chunks}</span>
							})}
						</p>
					</div>
					<RunSwitcher runId={runId} runs={workspace.runs} />
				</header>
				<RunNotFinished
					runId={runId}
					progress={progress}
					lastFinished={
						last == null ? null : { number: last.number, href: `${runBase(view, last.id)}/results` }
					}
				/>
			</>
		)
	}

	const parsed = parseResultFilters(rawFilters)
	const isDetailedTab = parsed.tab === 'detailed'
	// Detailed analysis: the pair shown beside the list, the chosen one (read
	// alongside the list, not after it) or else the first on this page.
	const [results, chosen] = await Promise.all([
		getRunResults({ scope, runId, filters: parsed }),
		selectedPair({ scope, runId, vendor: parsed.vendor, pairId: isDetailedTab ? parsed.sel : null })
	])
	const selected =
		chosen ??
		(isDetailedTab && parsed.sel == null
			? await selectedPair({ scope, runId, vendor: parsed.vendor, pairId: results.rows[0]?.id })
			: null)
	// The pairs either side of it on this page, rendered too, so stepping to
	// one is instant (pair-selection.tsx).
	const selectedIndex = results.rows.findIndex((row) => row.id === selected?.detail.row.id)
	const neighbours =
		selectedIndex === -1
			? []
			: await Promise.all(
					[results.rows[selectedIndex - 1], results.rows[selectedIndex + 1]].map((row) =>
						selectedPair({ scope, runId, vendor: parsed.vendor, pairId: row?.id })
					)
				)
	const { run, vendorId } = results
	const filters = { ...parsed, vendor: vendorId }
	const tab = filters.tab === 'detailed' ? 'detailed' : 'overview'
	const isFiltered = hasActiveFilters(filters)
	const vendorName = results.vendors.find((vendor) => vendor.id === vendorId)?.name ?? ''
	const incomplete = results.overview.metrics.counts.incomplete
	// The vendor's pairs in each group, and each vendor's colour: its place in
	// the upload order, the same on every screen (vendor-swatch.tsx).
	const vendorCounts = results.overview.byVendor.find((vendor) => vendor.id === vendorId)?.metrics
		.counts
	const vendorColours = Object.fromEntries(
		results.overview.byVendor.map((vendor, index) => [vendor.id, index])
	)
	// The order they're listed in: best overall first.
	const vendorRanks = Object.fromEntries(
		rankVendors(results.overview.byVendor).map((vendor, index) => [vendor.id, index])
	)

	const resultsPath = `${base}/results`
	const disagreementCount = (vendorCounts?.vendor_only ?? 0) + (vendorCounts?.pairsight_only ?? 0)
	const detailed = (query: Record<string, string>) => ({
		pathname: resultsPath,
		query: toQuery({ vendor: vendorId, tab: 'detailed', ...query })
	})
	const pairHref = (pairId: string) => ({
		pathname: `${base}/pairs/${pairId}`,
		query: toQuery({ vendor: vendorId, tab: 'detailed' })
	})
	// Each vendor's pairs in each group, in the detailed view.
	const categoryHrefs = Object.fromEntries(
		results.vendors.map((vendor) => [
			vendor.id,
			Object.fromEntries(
				(
					[
						'both_matched',
						'pairsight_only',
						'vendor_only',
						'neither_matched',
						'incomplete'
					] satisfies Array<Category | 'incomplete'>
				).map((category) => [
					category,
					`${resultsPath}?${new URLSearchParams(
						toQuery({ vendor: vendor.id, tab: 'detailed', category })
					)}`
				])
			)
		])
	)
	const vendorHrefs = Object.fromEntries(
		results.vendors.map((vendor) => [
			vendor.id,
			`${resultsPath}?${new URLSearchParams(
				toQuery({ vendor: vendor.id, tab: tab === 'detailed' ? 'detailed' : undefined })
			)}`
		])
	)

	return (
		<CutoffPreviewProvider runThreshold={run.threshold}>
			<ResultsKeyboard />
			<header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
					<RunStatusChip status={run.status} />
					{incomplete > 0 && (
						<Chip tone="outline" className="border-border-input border-dashed">
							{t('incompleteCount', { count: incomplete })}
						</Chip>
					)}
					<p className="text-text-muted font-mono text-sm">
						{t.rich('runMetaLine', {
							number: run.number,
							date: format.dateTime(run.completedAt ?? run.createdAt, {
								dateStyle: 'medium',
								timeStyle: 'short'
							}),
							model: results.models.join(', ') || run.jevModel,
							threshold: run.threshold.toFixed(2),
							assessed: results.overview.coverage.assessed,
							total: results.overview.coverage.total,
							n: (chunks) => <span className="text-text">{chunks}</span>
						})}
						{run.initialThreshold != null && run.initialThreshold !== run.threshold && (
							<> · {t('thresholdStartedAt', { threshold: run.initialThreshold.toFixed(2) })}</>
						)}
					</p>
				</div>
				<RunSwitcher runId={run.id} runs={workspace.runs} />
			</header>

			{/* On the Overview, the cut-off drawer: its tab hangs under the tabs here
			    and sticks under the top bar as the page scrolls. Detailed analysis's
			    list uses the run's own cut-off: one line says so, and links to the
			    Overview with the drawer open to try another. */}
			{tab === 'overview' && <CutoffBar rulesHref={`${view.base}/rules`} />}
			{tab === 'overview' && (
				<Verdict
					statsByVendor={results.statsByVendor}
					runThreshold={run.threshold}
					vendors={results.overview.byVendor}
				/>
			)}

			{tab === 'overview' ? (
				vendorId == null ? null : (
					<ResultsOverview
						overview={results.overview}
						vendorName={vendorName}
						vendorId={vendorId}
						entityType={entityTypeOf(run.entityType)}
						threshold={run.threshold}
						detailed={detailed}
						categoryHrefs={categoryHrefs}
						statsByVendor={results.statsByVendor}
						pairHref={pairHref}
						vendorHrefs={vendorHrefs}
					/>
				)
			) : (
				<div className="mt-9 flex flex-col gap-5">
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<p className="text-text-muted type-eyebrow">
								{t('reviewEyebrow', { vendor: vendorName })}
							</p>
							<h1 className="text-text font-display mt-3 text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em]">
								{t('reviewTitle', {
									count: results.matching,
									category: filters.category === 'disagreements' ? 'disagreements' : 'other'
								})}
							</h1>
						</div>
						<ShortcutsDialog set="results" showHint />
					</div>
					{/* Headings to jump between with a screen reader: the list, then the pair. */}
					<h2 className="sr-only">{t('pairsHeading')}</h2>
					<PairFilters
						vendors={results.vendors}
						vendorId={vendorId}
						matching={results.matching}
						isFiltered={isFiltered}
						viewCounts={{
							all: CATEGORIES.reduce((sum, category) => sum + (vendorCounts?.[category] ?? 0), 0),
							disagreements: disagreementCount
						}}
						vendorColours={vendorColours}
						vendorRanks={vendorRanks}
					/>
					<p className="text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						<span>
							{t.rich('cutoffDetailedHint', {
								value: run.threshold.toFixed(2),
								n: (chunks) => <span className="text-text font-mono font-medium">{chunks}</span>
							})}
						</span>
						<Link
							href={{
								pathname: resultsPath,
								query: { ...toQuery({ vendor: vendorId }), [CUTOFF_OPEN_PARAM]: 'open' }
							}}
							className="text-accent-ink hit-area inline-flex items-center gap-1 font-medium hover:underline"
						>
							{t('cutoffDetailedLink')}
							<ArrowRightIcon size={13} />
						</Link>
					</p>

					{results.rows.length === 0 ? (
						<EmptyState
							framed
							scene={<NoMatchesScene />}
							title={isFiltered ? t('noResults') : t('noPairs')}
							description={isFiltered ? t('noResultsHint') : t('noPairsHint')}
							className="py-14"
							actions={
								isFiltered && (
									<Button asChild variant="secondary" size="sm">
										<Link href={detailed({})}>
											<CloseIcon size={13} />
											{t('clear')}
										</Link>
									</Button>
								)
							}
						/>
					) : (
						<div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @5xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
							<PairSelection
								selectedId={selected?.detail.row.id ?? null}
								rows={results.rows.map((row) => ({
									id: row.id,
									href: `${resultsPath}?${new URLSearchParams(
										toQuery({ ...filters, tab: 'detailed', sel: row.id })
									)}`
								}))}
								panels={[selected, ...neighbours].flatMap((pair) =>
									pair == null
										? []
										: [
												{
													id: pair.detail.row.id,
													node: (
														<PairPanel
															detail={pair.detail}
															fullHref={{
																pathname: `${base}/pairs/${pair.detail.row.id}`,
																query: toQuery({ ...filters, tab: 'detailed', sel: undefined })
															}}
															vendorColours={vendorColours}
															vendorRanks={vendorRanks}
														/>
													)
												}
											]
								)}
							>
								<div className="border-border bg-surface overflow-hidden rounded-lg border">
									<PairsTable
										base={base}
										filters={filters}
										rows={results.rows}
										groupCounts={isNarrowed(filters) ? null : (vendorCounts ?? null)}
									/>
									<Pagination
										base={base}
										filters={filters}
										page={results.page}
										pageCount={results.pageCount}
										pageSize={results.pageSize}
										total={results.matching}
									/>
								</div>
							</PairSelection>
						</div>
					)}
				</div>
			)}
			{/* The dock: the steps, then Overview, Pairs and the downloads. */}
			<Dock>
				<ResultsTabs
					tab={tab}
					overviewHref={{ pathname: resultsPath, query: toQuery({ vendor: vendorId }) }}
					// From the Overview, Pairs opens on the vendor's disagreements, the
					// pairs worth opening, when it has any (pairsight-handoff Review).
					detailedHref={{
						pathname: resultsPath,
						query: toQuery({
							...filters,
							tab: 'detailed',
							page: undefined,
							category:
								tab === 'overview' && filters.category == null && disagreementCount > 0
									? 'disagreements'
									: filters.category
						})
					}}
					detailedCount={results.matching}
				/>
				<ExportMenu runId={run.id} runNumber={run.number} pairCount={run.pairCount} />
			</Dock>
		</CutoffPreviewProvider>
	)
}

const CATEGORIES = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched',
	'incomplete'
] satisfies Array<Category | 'incomplete'>

// A filter that narrows the list within a group (the search, score, source
// or status), so a group's full size isn't what's listed.
function isNarrowed(filters: ResultFilters): boolean {
	return (
		(filters.q ?? '') !== '' ||
		filters.score != null ||
		filters.source != null ||
		filters.status != null ||
		filters.lowConfidence != null
	)
}

// The pair Detailed analysis shows beside its list. Null when there's none
// to show (or the id isn't one).
async function selectedPair({
	scope,
	runId,
	vendor,
	pairId
}: {
	scope: EvaluationScope
	runId: string
	vendor: string | undefined
	pairId: string | null | undefined
}) {
	if (pairId == null || !isUuid(pairId)) return null
	const detail = await getPairPanel({ scope, runId, pairId, vendorFilter: vendor })
	return detail == null ? null : { detail }
}
