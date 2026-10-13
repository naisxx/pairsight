import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AnimatedScore } from '@/components/ui/animated-number'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ArrowRightIcon, WarningCircleIcon } from '@/components/ui/icons'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import { cn } from '@/lib/cn'
import { compareFields } from '@/server/pairsight/compare'
import type { getPairPanel } from '@/server/pairsight/results'
import { RetryPairButton } from '../pair/retry-pair-button'
import { ReadOnlyGate } from '../read-only'
import { VendorSwatch } from '../vendor-swatch'

const ARROW_SIZE = 18

type Detail = NonNullable<Awaited<ReturnType<typeof getPairPanel>>>
type Decision = 'same' | 'different' | 'notChecked'

// Same, different or not checked, as a tag. The = and ≠ are drawn by CSS, so
// the tag reads as its word alone (to a screen reader, and as text).
function DecisionChip({ decision, label }: { decision: Decision; label: string }) {
	return (
		<Chip className="gap-1.5">
			{decision !== 'notChecked' && (
				<span
					aria-hidden
					className={cn(
						decision === 'same'
							? "text-ice-text before:content-['=']"
							: "text-brand-text before:content-['≠']"
					)}
				/>
			)}
			{label}
		</Chip>
	)
}

// The pair selected in Pairs, beside the list (pairsight-handoff Review): its
// two record IDs, Jev's score against the cut-off, who says what (Jev, then
// each vendor). The fields side by side, why it was checked and J/K through
// the list are on its own page, a button away (pair-screen.tsx).
export async function PairPanel({
	detail,
	fullHref,
	vendorColours,
	vendorRanks
}: {
	detail: Detail
	fullHref: { pathname: string; query: Record<string, string> }
	// Each vendor's colour, in the order Results ranks them (vendor-swatch.tsx).
	vendorColours: Record<string, number>
	// Best overall first, as Results ranks them (ranking.ts).
	vendorRanks: Record<string, number>
}) {
	const [t, tResults, tFailures] = await Promise.all([
		getTranslations('Pair'),
		getTranslations('Results'),
		getTranslations('Failures')
	])
	const { run, row, recordA, recordB, assessment } = detail
	const isJudged = assessment.status === 'succeeded' && assessment.score != null
	const score = assessment.score ?? 0
	const isSame = isJudged && score >= run.threshold
	const { fields: allFields } = compareFields({
		valuesA: recordA.values,
		valuesB: recordB.values,
		columnRoles: detail.columnRoles,
		country: run.countryCode
	})
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const rowClass =
		'border-border flex items-center justify-between gap-3 border-b py-2.5 last:border-0'

	return (
		<aside
			aria-label={tResults('panelLabel')}
			className="border-border bg-surface flex min-h-0 flex-col rounded-lg border p-6 md:p-7 [&>*]:shrink-0"
		>
			<h2 className="sr-only">
				{tResults('panelHeading', { a: row.recordA.label, b: row.recordB.label })}
			</h2>
			<p className="text-text-muted type-eyebrow">
				{recordA.reference} · {recordB.reference}
			</p>

			{isJudged ? (
				<>
					<p className="mt-3.5">
						<AnimatedScore
							value={score}
							className="text-text font-mono text-5xl leading-none font-semibold tracking-[-0.03em]"
						/>
					</p>
					<p className="text-text-body mt-2 text-base">
						{tResults.rich(isSame ? 'panelVerdictSame' : 'panelVerdictDifferent', {
							value: run.threshold.toFixed(2),
							n: mono
						})}
					</p>
				</>
			) : (
				<div className="border-border-input mt-4 rounded-md border border-dashed p-4">
					<p className="flex items-center gap-2 text-base font-medium">
						<WarningCircleIcon
							className={assessment.status === 'failed' ? 'text-danger' : 'text-text-muted'}
						/>
						{assessment.status === 'failed' ? t('assessmentFailed') : t('assessmentPending')}
					</p>
					{assessment.status === 'failed' && (
						<>
							<p className="text-text-muted mt-1 text-sm" title={assessment.errorCode ?? undefined}>
								{tFailures(failureReason(assessment.errorCode))}
							</p>
							<div className="mt-3">
								<ReadOnlyGate action="retry">
									<RetryPairButton runId={run.id} pairId={row.id} />
								</ReadOnlyGate>
							</div>
						</>
					)}
				</div>
			)}

			{/* Who says what: Jev, then every vendor. */}
			<section aria-label={t('decisions')} className="border-border mt-4 border-t">
				<dl className="text-base">
					<div className={rowClass}>
						<dt>{t('pairsightAi')}</dt>
						<dd>
							<DecisionChip
								decision={isJudged ? (isSame ? 'same' : 'different') : 'notChecked'}
								label={isJudged ? (isSame ? t('match') : t('noMatch')) : t('notAssessed')}
							/>
						</dd>
					</div>
					{/* Best first, as the Overview's cards are. */}
					{[...detail.vendors]
						.sort((a, b) => (vendorRanks[a.id] ?? 0) - (vendorRanks[b.id] ?? 0))
						.map((vendor) => (
							<div key={vendor.id} className={rowClass}>
								<dt className="flex min-w-0 items-center gap-2">
									<VendorSwatch index={vendorColours[vendor.id] ?? 0} />
									<span className="truncate">{vendor.name}</span>
								</dt>
								<dd>
									<DecisionChip
										decision={vendor.isMatch ? 'same' : 'different'}
										label={vendor.isMatch ? t('matched') : t('notMatched')}
									/>
								</dd>
							</div>
						))}
				</dl>
			</section>

			<Button asChild cap={<ArrowRightIcon size={ARROW_SIZE} />} className="mt-6 self-start">
				<Link href={fullHref}>{tResults('openFullComparison')}</Link>
			</Button>
			<p className="text-text-muted mt-2.5 text-sm">
				{tResults('allFieldsNote', { count: allFields.length })}
			</p>
		</aside>
	)
}
