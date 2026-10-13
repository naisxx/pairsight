import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FieldCompareTable } from '@/components/pairsight/pair/field-compare-table'
import { JevPanel } from '@/components/pairsight/pair/jev-panel'
import { PairOrigin } from '@/components/pairsight/pair/pair-context'
import { PairKeyboard } from '@/components/pairsight/pair/pair-keyboard'
import { PairNav } from '@/components/pairsight/pair/pair-nav'
import { toQuery } from '@/components/pairsight/results/query'
import { ResultsTabs } from '@/components/pairsight/results/results-tabs'
import { ExportMenu } from '@/components/pairsight/results/export-menu'
import { Dock } from '@/components/pairsight/shell/dock'
import { compareFields } from '@/server/pairsight/compare'
import { isPairsightMatch } from '@/server/pairsight/decisions'
import { getPairDetail, parseResultFilters } from '@/server/pairsight/results'
import { isUuid } from '@/server/pairsight/schemas'
import { suggestionReasons } from '@/server/pairsight/splink/picks'
import type { loadRun } from '@/server/pairsight/evaluation-pages'

const SCORE_DIGITS = 2

// Pair detail (docs/PairSight-UX-Plan.md §4.2, pairsight-handoff Pair): the
// pair named, who says what in one dark bar, the two records side by side,
// Jev's judgment, and how the pair came to be compared. J/K step through the list it was opened from; Esc
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
	const [t, tRules, tCat] = await Promise.all([
		getTranslations('Pair'),
		getTranslations('Rules'),
		getTranslations('Categories')
	])
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
	const isJudged = assessment.status === 'succeeded' && assessment.score != null
	const score = assessment.score ?? 0
	const isSame = isJudged && isPairsightMatch({ score, threshold: run.threshold })
	const { fields, otherHeaders } = compareFields({
		valuesA: recordA.values,
		valuesB: recordB.values,
		columnRoles: detail.columnRoles,
		country: run.countryCode
	})

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
				isInFiltered={detail.isInFiltered}
			/>

			<header className="mt-7">
				<p className="text-text-muted type-eyebrow">
					{recordA.reference} · {recordB.reference} · {tCat(row.category)}
				</p>
				<h1 className="text-text font-display mt-3 text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
					{row.recordA.label}{' '}
					<span className="text-text-muted">
						<span aria-hidden>/</span>
						<span className="sr-only">{t('comparedWith')}</span> {row.recordB.label}
					</span>
				</h1>
			</header>

			{/* Who says what, in one bar: Jev's score and call, then each vendor's. */}
			<section
				aria-label={t('decisions')}
				className="bg-inverse text-on-inverse mt-7 flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg px-7 py-[22px]"
			>
				{isJudged ? (
					<>
						<span className="font-mono text-[3.25rem] leading-none font-semibold tracking-[-0.03em]">
							{score.toFixed(SCORE_DIGITS)}
						</span>
						<span className="flex-[1_1_220px] text-base">
							{t.rich(isSame ? 'barSame' : 'barDifferent', {
								value: run.threshold.toFixed(SCORE_DIGITS),
								b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
								n: (chunks) => <span className="font-mono">{chunks}</span>
							})}
						</span>
					</>
				) : (
					<span className="flex-[1_1_220px] text-base font-semibold">
						{assessment.status === 'failed' ? t('assessmentFailed') : t('assessmentPending')}
					</span>
				)}
				{detail.vendors.map((vendor) => (
					<span key={vendor.id} className="text-base">
						{t.rich('barVendor', {
							vendor: vendor.name,
							decision: vendor.isMatch ? 'same' : 'different',
							b: (chunks) => (
								<strong
									className={vendor.isMatch ? 'font-semibold' : 'text-inverse-brand font-semibold'}
								>
									{chunks}
								</strong>
							)
						})}
					</span>
				))}
			</section>
			<p className="text-text-muted mt-2.5 text-sm">{t('agreementNote')}</p>

			<div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 @5xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
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
				<div className="flex flex-col gap-4">
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
					<PairOrigin
						isSuggested={detail.isSuggested}
						matchingVendors={detail.vendors
							.filter((vendor) => vendor.isMatch)
							.map((vendor) => vendor.name)}
						suggestedBecause={suggestedBecause.map((reason) => tRules(`reason_${reason}`))}
					/>
				</div>
			</div>
			{/* The dock: the steps, then Overview, Pairs (this pair's list) and the downloads. */}
			<Dock>
				<ResultsTabs
					tab="detailed"
					overviewHref={{
						pathname: `${base}/results`,
						query: toQuery({ vendor: detail.vendorId })
					}}
					detailedHref={resultsHref}
					detailedCount={detail.listSize}
				/>
				<ExportMenu runId={run.id} runNumber={run.number} pairCount={run.pairCount} />
			</Dock>
		</>
	)
}
