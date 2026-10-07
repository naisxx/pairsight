import { useTranslations } from 'next-intl'
import { QuestionIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { EntityType } from '@/lib/pairsight/entity-types'
import type { ResultsOverview } from '@/server/pairsight/result-overview'
import { Count } from '@/components/ui/count'

const PERCENT = 100

// What was and wasn't assessed: the planned pairs by status, where they came
// from, and the possible pairs nobody compared (the blind spot recall can't see).
export function CoveragePanel({
	coverage,
	suggestedType,
	className
}: {
	coverage: ResultsOverview['coverage']
	// PairSight suggested some of the run's pairs (for this type of record):
	// say what that covers. Null when it didn't.
	suggestedType: EntityType | null
	className?: string
}) {
	const t = useTranslations('Overview')
	const share = (count: number) =>
		`${coverage.total === 0 ? 0 : (count / coverage.total) * PERCENT}%`
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>

	return (
		<Panel
			id="coverage"
			title={t('coverageTitle')}
			className={className}
			actions={
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="text-accent-ink hover:bg-surface-hover inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors duration-150"
						>
							<QuestionIcon size={14} />
							{t('howThisWorks')}
						</button>
					</PopoverTrigger>
					<PopoverContent align="end" className="type-ui w-[320px] leading-relaxed">
						<p className="font-semibold">{t('coverageHowTitle')}</p>
						<p className="text-text-muted mt-2">
							{t.rich('coverageHowRules', {
								suggested: coverage.suggested,
								added: coverage.addedByVendor,
								n: mono
							})}
						</p>
						<p className="text-text-muted mt-2">
							{t.rich('coverageHowBlindSpot', { notCompared: coverage.notCompared, n: mono })}
						</p>
					</PopoverContent>
				</Popover>
			}
		>
			<p className="flex items-baseline gap-2">
				<Count
					value={coverage.assessed}
					className="font-mono text-[26px] leading-none font-medium"
				/>
				<span className="text-text-muted type-ui">
					{t.rich('coverageAssessed', { total: coverage.total, n: mono })}
				</span>
			</p>
			<div
				role="img"
				aria-label={t('coverageBarLabel', {
					assessed: coverage.assessed,
					pending: coverage.pending,
					failed: coverage.failed
				})}
				className="bar-wipe bg-surface-muted mt-3 flex h-2 overflow-hidden rounded-full"
			>
				<span className="bg-text h-full" style={{ width: share(coverage.assessed) }} />
				<span className="bg-border-input h-full" style={{ width: share(coverage.pending) }} />
				<span className="bg-danger h-full" style={{ width: share(coverage.failed) }} />
			</div>
			<ul className="text-text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				{(
					[
						['assessed', 'bg-text', coverage.assessed],
						['pending', 'bg-border-input', coverage.pending],
						['failed', 'bg-danger', coverage.failed]
					] as const
				).map(([key, dot, count]) => (
					<li key={key} className="flex items-center gap-1.5">
						<span aria-hidden className={`size-2 rounded-full ${dot}`} />
						{t(`status.${key}`)} <Count value={count} className="text-text font-mono" />
					</li>
				))}
			</ul>
			<dl className="border-border type-ui mt-4 flex flex-col gap-1.5 border-t pt-3">
				{(
					[
						['suggested', coverage.suggested],
						['addedByVendor', coverage.addedByVendor],
						['notCompared', coverage.notCompared]
					] as const
				).map(([key, count]) => (
					<div key={key} className="flex justify-between gap-3">
						<dt className="text-text-muted">{t(`coverage.${key}`)}</dt>
						<dd className="font-mono">
							<Count value={count} />
						</dd>
					</div>
				))}
			</dl>
			<p className="text-text-muted mt-3 text-xs leading-relaxed">{t('coverageFootnote')}</p>
			{suggestedType != null && (
				<p className="text-text-muted mt-2 text-xs leading-relaxed">
					{t('coverageSuggested', { type: suggestedType })}
				</p>
			)}
		</Panel>
	)
}
