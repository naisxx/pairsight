import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AnimatedScore } from '@/components/ui/animated-number'
import { ArrowRightIcon, WarningCircleIcon } from '@/components/ui/icons'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import { cn } from '@/lib/cn'
import { compareFields } from '@/server/pairsight/compare'
import { keyFields } from '@/server/pairsight/key-fields'
import type { getPairPanel } from '@/server/pairsight/results'
import { DiffText } from '../pair/field-compare-table'
import { RetryPairButton } from '../pair/retry-pair-button'
import { ReadOnlyGate } from '../read-only'
import { CategoryBadge, ScoreBar } from '../result-parts'

const ARROW_SIZE = 13
// Fields shown beside the list; the pair's own page has every one.
const KEY_FIELDS = 3

type Detail = NonNullable<Awaited<ReturnType<typeof getPairPanel>>>

// The pair selected in Detailed analysis, beside the list: Jev's score
// against the cut-off, who says what, and the few fields that say most about
// it (key-fields.ts), what differs marked. Every field, why it was checked
// and J/K through the list are on its own page, a link away
// (pair-screen.tsx).
export async function PairPanel({
	detail,
	fullHref
}: {
	detail: Detail
	fullHref: { pathname: string; query: Record<string, string> }
}) {
	const [t, tResults, tRoles, tFailures] = await Promise.all([
		getTranslations('Pair'),
		getTranslations('Results'),
		getTranslations('Roles'),
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
	const fields = keyFields(allFields, run.jevFields, KEY_FIELDS)

	return (
		<aside
			aria-label={tResults('panelLabel')}
			className="border-border bg-surface rounded-lg border p-5 md:p-6"
		>
			<h2 className="sr-only">
				{tResults('panelHeading', { a: row.recordA.label, b: row.recordB.label })}
			</h2>
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					<p className="text-text-muted font-mono text-xs">
						{recordA.reference} · {recordB.reference}
					</p>
					<CategoryBadge category={row.category} />
				</div>
				<Link
					href={fullHref}
					className="text-accent-ink type-ui hit-area inline-flex shrink-0 items-center gap-1 font-medium hover:underline"
				>
					{tResults('panelFullComparison')}
					<ArrowRightIcon size={ARROW_SIZE} />
				</Link>
			</div>

			{isJudged ? (
				<div className="mt-5">
					<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<AnimatedScore
							value={score}
							className="font-mono text-5xl leading-none font-medium tracking-[-0.04em]"
						/>
						<span className="text-text-muted type-ui">
							{tResults.rich(isSame ? 'panelSaysSame' : 'panelSaysDifferent', {
								value: run.threshold.toFixed(2),
								n: (chunks) => <span className="text-text font-mono">{chunks}</span>
							})}
						</span>
					</p>
					<span
						role="img"
						aria-label={t('scoreBarLabel', {
							score: score.toFixed(2),
							threshold: run.threshold.toFixed(2)
						})}
						className="mt-3 flex"
					>
						<ScoreBar score={score} threshold={run.threshold} size="lg" showValue={false} />
					</span>
				</div>
			) : (
				<div className="border-border-input mt-5 rounded-md border border-dashed p-4">
					<p className="type-ui flex items-center gap-2 font-medium">
						<WarningCircleIcon
							className={assessment.status === 'failed' ? 'text-danger' : 'text-text-muted'}
						/>
						{assessment.status === 'failed' ? t('assessmentFailed') : t('assessmentPending')}
					</p>
					{assessment.status === 'failed' && (
						<>
							<p className="text-text-muted type-ui mt-1" title={assessment.errorCode ?? undefined}>
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

			{/* Who says what: every vendor, then Jev. */}
			<section aria-label={t('decisions')} className="border-border mt-5 border-t pt-4">
				<dl className="type-ui grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
					{detail.vendors.map((vendor) => (
						<div key={vendor.id} className="contents">
							<dt className="text-text-muted truncate">{vendor.name}</dt>
							<dd className={vendor.isMatch ? 'font-medium' : 'text-text-muted'}>
								{vendor.isMatch ? t('matched') : t('notMatched')}
							</dd>
						</div>
					))}
					<div className="contents">
						<dt className="text-text-muted">{t('pairsightAi')}</dt>
						<dd className={isSame ? 'font-medium' : 'text-text-muted'}>
							{isJudged ? (isSame ? t('match') : t('noMatch')) : t('notAssessed')}
						</dd>
					</div>
				</dl>
			</section>

			{/* The two records, field by field. */}
			<section aria-label={t('fieldsTitle')} className="border-border mt-5 border-t pt-4">
				<div className="text-text-muted grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 pb-2 text-xs font-medium">
					<span>{t('field')}</span>
					<span className="truncate">
						{t('recordA')} · <span className="font-mono">{recordA.reference}</span>
					</span>
					<span className="truncate">
						{t('recordB')} · <span className="font-mono">{recordB.reference}</span>
					</span>
				</div>
				<ul className="divide-border divide-y">
					{fields.map((field) => {
						const isDifferent = field.comparison === 'different'
						return (
							<li
								key={field.role}
								className={cn(
									'type-ui grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 py-2',
									isDifferent && 'bg-diff -mx-2 rounded-sm px-2'
								)}
							>
								<span className="text-text-muted truncate">{tRoles(field.role)}</span>
								{[
									[field.a, field.b],
									[field.b, field.a]
								].map(([value, other], index) =>
									value == null || other == null ? null : (
										<span key={index} className="min-w-0 break-words">
											{value.trim() === '' ? (
												<span className="text-text-muted text-xs italic">{t('missing')}</span>
											) : isDifferent ? (
												<DiffText value={value} other={other} />
											) : (
												value
											)}
											{/* Same once normalised: said, so it doesn't read as a difference. */}
											{index === 1 && field.isFormatOnly && (
												<span className="text-text-muted ml-1.5 text-xs">{t('formatDiffers')}</span>
											)}
										</span>
									)
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<Link
				href={fullHref}
				className="text-accent-ink type-ui hit-area mt-4 inline-flex items-center gap-1.5 font-medium hover:underline"
			>
				{tResults('panelSeeAll', { count: allFields.length })}
				<ArrowRightIcon size={ARROW_SIZE} />
			</Link>
		</aside>
	)
}
