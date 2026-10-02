import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { CloseIcon, FilterIcon } from '@/components/ui/icons'
import { Kbd } from '@/components/ui/kbd'
import { ResultsOverview } from '@/components/pairsight/results/overview/results-overview'
import { Pagination } from '@/components/pairsight/results/pagination'
import { PairFilters } from '@/components/pairsight/results/pair-filters'
import { PairsTable } from '@/components/pairsight/results/pairs-table'
import { hasActiveFilters, toQuery } from '@/components/pairsight/results/query'
import { ResultsKeyboard } from '@/components/pairsight/results/results-keyboard'
import { ResultsTabs } from '@/components/pairsight/results/results-tabs'
import { RunStatusChip } from '@/components/pairsight/results/run-status-chip'
import { RunSwitcher } from '@/components/pairsight/results/run-switcher'
import { VendorSegmented } from '@/components/pairsight/results/vendor-segmented'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { ThresholdControl } from '@/components/pairsight/threshold-control'
import { getRunResults, parseResultFilters } from '@/server/pairsight/results'
import { parseBlockingRules } from '@/server/pairsight/json'
import type { LoadedWorkspace, loadRun } from '@/server/pairsight/evaluation-pages'

// Results (docs/PairSight-UX-Plan.md §4.1): the run's header, the vendor and
// threshold controls, then the Overview or the Detailed analysis. Everything
// that changes the view is in the URL, so it's shareable and Back works.
export async function ResultsScreen({
	loaded,
	workspace,
	rawFilters
}: {
	loaded: Awaited<ReturnType<typeof loadRun>>
	workspace: LoadedWorkspace['workspace']
	rawFilters: Record<string, string | string[] | undefined>
}) {
	const { scope, base } = loaded
	const runId = loaded.run.id
	const [t, tRules, tRoles, format] = await Promise.all([
		getTranslations('Results'),
		getTranslations('Rules'),
		getTranslations('Roles'),
		getFormatter()
	])
	const parsed = parseResultFilters(rawFilters)
	const results = await getRunResults({ scope, runId, filters: parsed })
	const { run, vendorId } = results
	const filters = { ...parsed, vendor: vendorId }
	const tab = filters.tab === 'detailed' ? 'detailed' : 'overview'
	const isFiltered = hasActiveFilters(filters)
	const vendorName = results.vendors.find((vendor) => vendor.id === vendorId)?.name ?? ''
	const rules = parseBlockingRules(run.blockingRules)
	const ruleLabels = Object.fromEntries(
		rules.map((rule) => [rule.id, ruleLabel({ ruleId: rule.id, rules, tRules, tRoles })])
	)
	const incomplete = results.overview.metrics.counts.incomplete

	const resultsPath = `${base}/results`
	const detailed = (query: Record<string, string>) => ({
		pathname: resultsPath,
		query: toQuery({ vendor: vendorId, tab: 'detailed', ...query })
	})
	const pairHref = (pairId: string) => ({
		pathname: `${base}/pairs/${pairId}`,
		query: toQuery({ vendor: vendorId, tab: 'detailed' })
	})
	const vendorHrefs = Object.fromEntries(
		results.vendors.map((vendor) => [
			vendor.id,
			`${resultsPath}?${new URLSearchParams(
				toQuery({ vendor: vendor.id, tab: tab === 'detailed' ? 'detailed' : undefined })
			)}`
		])
	)

	return (
		<>
			{/* Widens the page column (globals.css, .page-frame). */}
			<span data-wide-page hidden />
			<ResultsKeyboard />
			<header>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-text type-title">{run.evaluation.name}</h1>
							<RunStatusChip status={run.status} />
							{incomplete > 0 && (
								<Chip tone="outline" className="border-border-input border-dashed">
									{t('incompleteCount', { count: incomplete })}
								</Chip>
							)}
						</div>
						<p className="text-text-muted type-ui mt-1">
							{t.rich('runMeta', {
								model: results.models.join(', ') || run.jevModel,
								date: format.dateTime(run.completedAt ?? run.createdAt, {
									dateStyle: 'medium',
									timeStyle: 'short'
								}),
								total: results.overview.coverage.total,
								n: (chunks) => <span className="text-text font-mono">{chunks}</span>
							})}
							{run.initialThreshold != null && run.initialThreshold !== run.threshold && (
								<> · {t('thresholdStartedAt', { threshold: run.initialThreshold.toFixed(2) })}</>
							)}
						</p>
					</div>
					<RunSwitcher runId={run.id} runs={workspace.runs} />
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
					{results.vendors.length > 1 && vendorId != null && (
						<VendorSegmented vendors={results.vendors} vendorId={vendorId} hrefs={vendorHrefs} />
					)}
					<ThresholdControl
						runId={run.id}
						threshold={run.threshold}
						initialThreshold={run.initialThreshold}
						vendorName={vendorName}
						pairs={results.metricPairs}
					/>
				</div>

				<ResultsTabs
					tab={tab}
					overviewHref={{ pathname: resultsPath, query: toQuery({ vendor: vendorId }) }}
					detailedHref={{
						pathname: resultsPath,
						query: toQuery({ ...filters, tab: 'detailed', page: undefined })
					}}
					detailedCount={results.matching}
				/>
			</header>

			{tab === 'overview' ? (
				vendorId == null ? null : (
					<ResultsOverview
						overview={results.overview}
						vendorName={vendorName}
						vendorId={vendorId}
						threshold={run.threshold}
						ruleLabels={ruleLabels}
						detailed={detailed}
						pairHref={pairHref}
						vendorHrefs={vendorHrefs}
					/>
				)
			) : (
				<div className="mt-5 flex flex-col gap-3">
					<PairFilters
						vendors={results.vendors}
						vendorId={vendorId}
						matching={results.matching}
						isFiltered={isFiltered}
					/>
					{results.rows.length === 0 ? (
						<div className="border-border bg-surface flex flex-col items-center justify-center rounded-md border px-6 py-16 text-center">
							<span className="bg-surface-muted text-text-muted flex size-10 items-center justify-center rounded-md">
								<FilterIcon size={20} />
							</span>
							<h2 className="type-subheading mt-3">{isFiltered ? t('noResults') : t('noPairs')}</h2>
							<p className="text-text-muted type-ui mt-1 max-w-sm">
								{isFiltered ? t('noResultsHint') : t('noPairsHint')}
							</p>
							{isFiltered && (
								<Button asChild variant="secondary" size="sm" className="mt-4">
									<Link href={detailed({})}>
										<CloseIcon size={13} />
										{t('clear')}
									</Link>
								</Button>
							)}
						</div>
					) : (
						<div>
							<PairsTable
								runId={run.id}
								base={base}
								filters={filters}
								rows={results.rows}
								threshold={run.threshold}
								vendorName={vendorName}
								ruleLabels={ruleLabels}
							/>
							<Pagination
								base={base}
								filters={filters}
								page={results.page}
								pageCount={results.pageCount}
								pageSize={results.pageSize}
								total={results.matching}
							/>
							<p className="text-text-muted mt-3 flex flex-wrap items-center gap-1 text-xs">
								{t.rich('keyboardHint', { key: (chunks) => <Kbd>{chunks}</Kbd> })}
							</p>
						</div>
					)}
				</div>
			)}
		</>
	)
}
