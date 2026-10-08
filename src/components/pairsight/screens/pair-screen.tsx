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
import { compareFields } from '@/server/pairsight/compare'
import { isPairsightMatch } from '@/server/pairsight/decisions'
import { getPairDetail, parseResultFilters } from '@/server/pairsight/results'
import { isUuid } from '@/server/pairsight/schemas'
import { suggestionReasons } from '@/server/pairsight/splink/picks'
import type { loadRun } from '@/server/pairsight/evaluation-pages'

// Pair detail (docs/PairSight-UX-Plan.md §4.2): the two records side by
// side, both decisions and their agreement, Jev's judgment, and how the pair
// came to be compared. J/K step through the list it was opened from; Esc
// goes back to it with this pair highlighted.
export async function PairScreen({
	loaded,
	pairId,
	rawFilters
}: {
	loaded: Awaited<ReturnType<typeof loadRun>>
	pairId: string
	rawFilters: Record<string, string | string[] | undefined>
}) {
	if (!isUuid(pairId)) notFound()
	const { scope, base } = loaded
	const runId = loaded.run.id
	const filters = parseResultFilters(rawFilters)
	const [t, tRules] = await Promise.all([getTranslations('Pair'), getTranslations('Rules')])
	const detail = await getPairDetail({ scope, runId, pairId, filters })
	if (detail == null) notFound()

	const { run, row, recordA, recordB, assessment } = detail
	// Suggested by PairSight: why, in words.
	const suggestedBecause = detail.isSuggested
		? await suggestionReasons({
				datasetId: run.datasetId,
				recordAId: recordA.id,
				recordBId: recordB.id
			})
		: []
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
				<h1 className="type-title mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 md:text-[1.75rem]">
					<span>{row.recordA.label}</span>
					<SwapIcon size={18} className="text-text-muted" />
					<span className="sr-only">{t('comparedWith')}</span>
					<span>{row.recordB.label}</span>
				</h1>
			</header>

			<section
				aria-label={t('decisions')}
				className="border-border bg-surface type-ui mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border px-4 py-3"
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
				<span aria-hidden className="bg-border hidden h-4 w-px @3xl:block" />
				<span className="flex items-center gap-2">
					<span className="text-text-muted">{t('pairsightAi')}</span>
					<span className={pairsightDecision === t('match') ? 'font-medium' : 'text-text-muted'}>
						{pairsightDecision}
					</span>
				</span>
				<span aria-hidden className="bg-border hidden h-4 w-px @3xl:block" />
				<CategoryBadge category={row.category} />
				<span className="text-text-muted text-xs">{t('agreementNote')}</span>
			</section>

			<div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 @5xl:grid-cols-12">
				<div className="flex flex-col gap-4 @5xl:col-span-8">
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
						isSuggested={detail.isSuggested}
						matchingVendors={detail.vendors
							.filter((vendor) => vendor.isMatch)
							.map((vendor) => vendor.name)}
						suggestedBecause={suggestedBecause.map((reason) => tRules(`reason_${reason}`))}
					/>
				</div>
				{/* In one column, Jev's verdict comes before the field-by-field detail. */}
				<aside
					aria-label={t('judgments')}
					className="order-first flex flex-col gap-4 @5xl:order-none @5xl:col-span-4"
				>
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
