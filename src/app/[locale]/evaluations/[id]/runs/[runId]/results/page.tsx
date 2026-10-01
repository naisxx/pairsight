import { getFormatter, getTranslations } from 'next-intl/server'
import { EmptyState } from '@/components/pairsight/empty/empty-state'
import { NoMatchesIcon } from '@/components/ui/icons'
import { CategoryTiles } from '@/components/pairsight/results/category-tiles'
import { CoverageNotice } from '@/components/pairsight/results/coverage-notice'
import { Pagination } from '@/components/pairsight/results/pagination'
import { PairsTable } from '@/components/pairsight/results/pairs-table'
import { ResultsKeyboard } from '@/components/pairsight/results/results-keyboard'
import { RunStatusChip } from '@/components/pairsight/results/run-status-chip'
import { RunSwitcher } from '@/components/pairsight/results/run-switcher'
import { VendorChart } from '@/components/pairsight/results/vendor-chart'
import { hasActiveFilters } from '@/components/pairsight/results/query'
import { ClearFiltersLink, ResultsFilters } from '@/components/pairsight/results/results-filters'
import { VendorTabs } from '@/components/pairsight/results/vendor-tabs'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { StepHeader } from '@/components/pairsight/step-layout'
import { ThresholdControl } from '@/components/pairsight/threshold-control'
import { getRunResults, parseResultFilters } from '@/server/pairsight/results'
import { parseBlockingRules } from '@/server/pairsight/json'
import { loadWorkspace } from '../../../workspace'
import { loadRun } from '../run'

export default async function ResultsPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId }, rawFilters] = await Promise.all([params, searchParams])
	const base = `/evaluations/${id}/runs/${runId}`
	const [{ user }, { workspace }, t, tRules, tRoles, format] = await Promise.all([
		loadRun({ id, runId, path: `${base}/results` }),
		// Already loaded by the workspace layout this request; cached, not queried again.
		loadWorkspace(id, `${base}/results`),
		getTranslations('Results'),
		getTranslations('Rules'),
		getTranslations('Roles'),
		getFormatter()
	])
	const results = await getRunResults({
		ownerId: user.id,
		runId,
		filters: parseResultFilters(rawFilters)
	})
	const { run, counts } = results
	const filters = { ...parseResultFilters(rawFilters), vendor: results.vendorId }
	const isFiltered = hasActiveFilters(filters)
	const rules = parseBlockingRules(run.blockingRules)
	const ruleLabels = Object.fromEntries(
		rules.map((rule) => [rule.id, ruleLabel({ ruleId: rule.id, rules, tRules, tRoles })])
	)

	return (
		<>
			<ResultsKeyboard />
			<StepHeader title={t('title')} description={t('agreementNote')}>
				<RunStatusChip status={run.status} />
			</StepHeader>
			<div className="-mt-3 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
				{workspace.runs.length > 1 && (
					<RunSwitcher evaluationId={id} runId={run.id} runs={workspace.runs} />
				)}
				<span className="text-text-muted type-body">
					{t('runMeta', {
						number: run.number,
						date: format.dateTime(run.createdAt, { dateStyle: 'medium' }),
						threshold: run.threshold.toFixed(2),
						model: results.models.join(', ') || run.jevModel
					})}
				</span>
			</div>
			<VendorTabs base={base} vendors={results.vendors} vendorId={results.vendorId} />
			<CategoryTiles base={base} filters={filters} counts={counts} evaluated={results.evaluated} />
			{results.vendorCounts.length > 0 && <VendorChart vendors={results.vendorCounts} />}
			<CoverageNotice runHref={base} coverage={results.coverage} incomplete={counts.incomplete} />
			<div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<ResultsFilters base={base} filters={filters} />
				<ThresholdControl runId={run.id} threshold={run.threshold} judged={results.judged} />
			</div>
			<p className="text-text-muted type-body mt-4 mb-2" aria-live="polite">
				{t('matching', { count: results.matching })}
			</p>
			{results.rows.length === 0 ? (
				<div className="border-border bg-surface rounded-lg border">
					<EmptyState
						icon={NoMatchesIcon}
						title={isFiltered ? t('noResults') : t('noPairs')}
						description={isFiltered ? t('noResultsHint') : t('noPairsHint')}
						preview="table"
						previewHeaders={[
							t('columnCategory'),
							t('columnRecordA'),
							t('columnRecordB'),
							t('columnScore')
						]}
						actions={
							isFiltered && (
								<ClearFiltersLink base={base} vendor={results.vendorId} appearance="button" />
							)
						}
					/>
				</div>
			) : (
				<PairsTable
					base={base}
					filters={filters}
					rows={results.rows}
					threshold={run.threshold}
					vendorName={results.vendors.find((vendor) => vendor.id === results.vendorId)?.name ?? ''}
					ruleLabels={ruleLabels}
				/>
			)}
			<Pagination base={base} filters={filters} page={results.page} pageCount={results.pageCount} />
			{results.rows.length > 0 && (
				<p className="text-text-muted type-meta mt-3 flex flex-wrap items-center gap-1">
					{t.rich('keyboardHint', {
						key: (chunks) => <kbd className="type-kbd text-text">{chunks}</kbd>
					})}
				</p>
			)}
		</>
	)
}
