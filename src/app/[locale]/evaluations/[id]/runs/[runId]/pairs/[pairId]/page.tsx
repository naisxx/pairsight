import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AllColumns, FieldCompareTable } from '@/components/pairsight/pair/field-compare-table'
import { JevPanel } from '@/components/pairsight/pair/jev-panel'
import { PairOrigin, VendorDecisions } from '@/components/pairsight/pair/pair-context'
import { PairKeyboard } from '@/components/pairsight/pair/pair-keyboard'
import { PairNav } from '@/components/pairsight/pair/pair-nav'
import { VerdictStrip } from '@/components/pairsight/pair/verdict-strip'
import { toQuery } from '@/components/pairsight/results/query'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { compareFields } from '@/server/pairsight/compare'
import { isPairsightMatch } from '@/server/pairsight/decisions'
import { getPairDetail, parseResultFilters } from '@/server/pairsight/results'
import { isUuid } from '@/server/pairsight/schemas'
import { parseBlockingRules } from '@/server/pairsight/json'
import { loadRun } from '../../run'

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
	const query = toQuery({ ...filters, vendor: detail.vendorId })
	const pairHref = (targetId: string) => ({ pathname: `${base}/pairs/${targetId}`, query })
	const asUrl = (href: { pathname: string; query: Record<string, string> }) =>
		`${href.pathname}?${new URLSearchParams(href.query)}`
	const resultsHref = { pathname: `${base}/results`, query }
	const previousHref = detail.previousId != null ? pairHref(detail.previousId) : null
	const nextHref = detail.nextId != null ? pairHref(detail.nextId) : null
	const pairsightDecision =
		assessment.status === 'succeeded' && assessment.score != null
			? isPairsightMatch({ score: assessment.score, threshold: run.threshold })
				? t('match')
				: t('noMatch')
			: t('notJudged')
	const { fields, otherHeaders } = compareFields({
		valuesA: recordA.values,
		valuesB: recordB.values,
		columnRoles: detail.columnRoles,
		country: run.countryCode
	})
	const rules = parseBlockingRules(run.blockingRules)

	return (
		<>
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
			/>
			<VerdictStrip
				category={row.category}
				vendorName={detail.vendors.find((vendor) => vendor.id === detail.vendorId)?.name ?? '—'}
				isVendorMatch={row.isVendorMatch}
				pairsightDecision={pairsightDecision}
			/>
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-4">
					<FieldCompareTable
						fields={fields}
						referenceA={recordA.reference}
						referenceB={recordB.reference}
					/>
					<AllColumns headers={otherHeaders} valuesA={recordA.values} valuesB={recordB.values} />
				</div>
				<aside className="flex flex-col gap-4">
					<JevPanel
						status={assessment.status}
						score={assessment.score}
						errorCode={assessment.errorCode}
						modelReported={assessment.modelReported}
						fallbackModel={run.jevModel}
						completedAt={assessment.completedAt}
						threshold={run.threshold}
						decision={pairsightDecision}
					/>
					<PairOrigin
						ruleLabels={detail.ruleIds.map((ruleId) =>
							ruleLabel({ ruleId, rules, tRules, tRoles })
						)}
						matchingVendors={detail.vendors
							.filter((vendor) => vendor.isMatch)
							.map((vendor) => vendor.name)}
					/>
					<VendorDecisions vendors={detail.vendors} />
					<p className="text-text-muted type-meta flex flex-wrap items-center gap-1">
						{t.rich('keyboardHint', {
							key: (chunks) => <kbd className="type-kbd text-text">{chunks}</kbd>
						})}
					</p>
				</aside>
			</div>
		</>
	)
}
