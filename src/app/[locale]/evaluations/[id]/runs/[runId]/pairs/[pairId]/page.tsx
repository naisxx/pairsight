import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CheckIcon, MinusIcon, SwapIcon } from '@/components/ui/icons'
import { FieldCompareTable } from '@/components/pairsight/pair/field-compare-table'
import { JevPanel } from '@/components/pairsight/pair/jev-panel'
import { PairOrigin, VendorDecisions } from '@/components/pairsight/pair/pair-context'
import { PairKeyboard } from '@/components/pairsight/pair/pair-keyboard'
import { PairNav } from '@/components/pairsight/pair/pair-nav'
import { CategoryBadge } from '@/components/pairsight/result-parts'
import { toQuery } from '@/components/pairsight/results/query'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { compareFields } from '@/server/pairsight/compare'
import { isPairsightMatch } from '@/server/pairsight/decisions'
import { getPairDetail, parseResultFilters } from '@/server/pairsight/results'
import { isUuid } from '@/server/pairsight/schemas'
import { parseBlockingRules } from '@/server/pairsight/json'
import { loadRun } from '../../run'

// Pair detail (docs/PairSight-UX-Plan.md §4.2): the two records side by
// side, both decisions and their agreement, Jev's judgment, and how the pair
// came to be compared. J/K step through the list it was opened from; Esc
// goes back to it with this pair highlighted.
export default async function PairPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string; pairId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId, pairId }, rawFilters] = await Promise.all([params, searchParams])
	if (!isUuid(pairId)) notFound()
	const base = `/evaluations/${id}/runs/${runId}`
	const filters = parseResultFilters(rawFilters)
	const [{ user }, t, tRules, tRoles] = await Promise.all([
		loadRun({ id, runId, path: `${base}/pairs/${pairId}` }),
		getTranslations('Pair'),
		getTranslations('Rules'),
		getTranslations('Roles')
	])
	const detail = await getPairDetail({ ownerId: user.id, runId, pairId, filters })
	if (detail == null) notFound()

	const { run, row, recordA, recordB, assessment } = detail
	const query = toQuery({ ...filters, vendor: detail.vendorId, sel: undefined })
	const pairHref = (targetId: string) => ({ pathname: `${base}/pairs/${targetId}`, query })
	const asUrl = (href: { pathname: string; query: Record<string, string> }) =>
		`${href.pathname}?${new URLSearchParams(href.query)}`
	// Back to the same list, with this pair highlighted.
	const resultsHref = {
		pathname: `${base}/results`,
		query: toQuery({ ...filters, vendor: detail.vendorId, sel: pairId })
	}
	const previousHref = detail.previousId != null ? pairHref(detail.previousId) : null
	const nextHref = detail.nextId != null ? pairHref(detail.nextId) : null
	const pairsightDecision =
		assessment.status === 'succeeded' && assessment.score != null
			? isPairsightMatch({ score: assessment.score, threshold: run.threshold })
				? t('match')
				: t('noMatch')
			: t('notAssessed')
	const { fields, otherHeaders } = compareFields({
		valuesA: recordA.values,
		valuesB: recordB.values,
		columnRoles: detail.columnRoles,
		country: run.countryCode
	})
	const rules = parseBlockingRules(run.blockingRules)
	const vendorName = detail.vendors.find((vendor) => vendor.id === detail.vendorId)?.name ?? '—'

	return (
		<>
			{/* Widens the page column (globals.css, .page-frame). */}
			<span data-wide-page hidden />
			<PairKeyboard
				previousHref={previousHref != null ? asUrl(previousHref) : null}
				nextHref={nextHref != null ? asUrl(nextHref) : null}
				backHref={asUrl(resultsHref)}
			/>
			<PairNav
				resultsHref={resultsHref}
				previousHref={previousHref}
				nextHref={nextHref}
				position={detail.position}
				total={detail.listSize}
				isInFiltered={detail.isInFiltered}
			/>

			<header className="mt-4">
				<p className="text-text-muted font-mono text-xs">
					{recordA.reference} · {recordB.reference}
				</p>
				<h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold tracking-[-0.01em]">
					<span>{row.recordA.label}</span>
					<SwapIcon size={18} className="text-text-muted" />
					<span className="sr-only">{t('comparedWith')}</span>
					<span>{row.recordB.label}</span>
				</h1>
			</header>

			<section
				aria-label={t('decisions')}
				className="border-border bg-surface type-ui mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-md border px-4 py-3"
			>
				<span className="flex items-center gap-2">
					<span className="text-text-muted">{vendorName}</span>
					{row.isVendorMatch ? (
						<span className="inline-flex items-center gap-1 font-medium">
							<CheckIcon size={14} variant="bold" /> {t('matched')}
						</span>
					) : (
						<span className="text-text-muted inline-flex items-center gap-1">
							<MinusIcon size={14} /> {t('notMatched')}
						</span>
					)}
				</span>
				<span aria-hidden className="bg-border h-4 w-px" />
				<span className="flex items-center gap-2">
					<span className="text-text-muted">{t('pairsightAi')}</span>
					<span className={pairsightDecision === t('match') ? 'font-medium' : 'text-text-muted'}>
						{pairsightDecision}
					</span>
				</span>
				<span aria-hidden className="bg-border h-4 w-px" />
				<CategoryBadge category={row.category} />
				<span className="text-text-muted text-xs">{t('agreementNote')}</span>
			</section>

			<div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
				<div className="flex flex-col gap-4 lg:col-span-8">
					<FieldCompareTable
						fields={fields}
						others={otherHeaders.map((header) => ({
							header,
							a: recordA.values[header] ?? '',
							b: recordB.values[header] ?? ''
						}))}
						sentRoles={run.jevFields}
						referenceA={recordA.reference}
						referenceB={recordB.reference}
					/>
					<PairOrigin
						ruleLabels={detail.ruleIds.map((ruleId) =>
							ruleLabel({ ruleId, rules, tRules, tRoles })
						)}
						matchingVendors={detail.vendors
							.filter((vendor) => vendor.isMatch)
							.map((vendor) => vendor.name)}
					/>
				</div>
				<aside aria-label={t('judgments')} className="flex flex-col gap-4 lg:col-span-4">
					<JevPanel
						runId={run.id}
						pairId={pairId}
						status={assessment.status}
						score={assessment.score}
						errorCode={assessment.errorCode}
						modelReported={assessment.modelReported}
						fallbackModel={run.jevModel}
						completedAt={assessment.completedAt}
						threshold={run.threshold}
					/>
					<VendorDecisions vendors={detail.vendors} />
				</aside>
			</div>
		</>
	)
}
