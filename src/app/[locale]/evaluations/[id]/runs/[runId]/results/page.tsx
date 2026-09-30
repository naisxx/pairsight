import { getFormatter, getTranslations } from 'next-intl/server'
import { CategoryTiles } from '@/components/pairsight/results/category-tiles'
import { CoverageNotice } from '@/components/pairsight/results/coverage-notice'
import { Pagination } from '@/components/pairsight/results/pagination'
import { PairsTable } from '@/components/pairsight/results/pairs-table'
import { hasActiveFilters } from '@/components/pairsight/results/query'
import { ClearFiltersLink, ResultsFilters } from '@/components/pairsight/results/results-filters'
import { VendorTabs } from '@/components/pairsight/results/vendor-tabs'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { StepHeader } from '@/components/pairsight/step-layout'
import { ThresholdControl } from '@/components/pairsight/threshold-control'
import { getRunResults, parseResultFilters } from '@/server/pairsight/results'
import { parseBlockingRules } from '@/server/pairsight/json'
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
	const [{ user }, t, tRules, tRoles, format] = await Promise.all([
		loadRun({ id, runId, path: `${base}/results` }),
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
	const rules = parseBlockingRules(run.blockingRules)
	const ruleLabels = Object.fromEntries(
		rules.map((rule) => [rule.id, ruleLabel({ ruleId: rule.id, rules, tRules, tRoles })])
	)

	return (
		<>
			<StepHeader title={t('title')} description={t('agreementNote')}>
				<span className="text-text-muted text-sm tabular-nums">
					{t('runMeta', {
						number: run.number,
						date: format.dateTime(run.createdAt, { dateStyle: 'medium' }),
						threshold: run.threshold.toFixed(2),
						model: results.models.join(', ') || run.jevModel
					})}
				</span>
			</StepHeader>
			<VendorTabs base={base} vendors={results.vendors} vendorId={results.vendorId} />
			<CategoryTiles base={base} filters={filters} counts={counts} evaluated={results.evaluated} />
			<CoverageNotice runHref={base} coverage={results.coverage} incomplete={counts.incomplete} />
			<div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<ResultsFilters base={base} filters={filters} />
				<ThresholdControl runId={run.id} threshold={run.threshold} />
			</div>
			<p className="text-text-muted mt-4 mb-2 text-sm tabular-nums" aria-live="polite">
				{t('matching', { count: results.matching })}
			</p>
			{results.rows.length === 0 ? (
				<div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
					<p className="text-text font-medium">{t('noResults')}</p>
					{hasActiveFilters(filters) && <ClearFiltersLink base={base} vendor={results.vendorId} />}
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
		</>
	)
}
