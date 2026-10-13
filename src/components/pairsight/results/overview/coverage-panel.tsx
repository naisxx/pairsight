import { useTranslations } from 'next-intl'
import { EXACT_FORMATS } from '@/i18n/formats'
import { QuestionIcon } from '@/components/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { EntityType } from '@/lib/pairsight/entity-types'
import type { ResultsOverview } from '@/server/pairsight/result-overview'
import { Count } from '@/components/ui/count'
import { cn } from '@/lib/cn'

// What was checked: the pairs Jev checked, where they came from (suggested
// by PairSight, or added because a vendor matched them), and the possible
// pairs nobody compared — the blind spot "duplicates found" can't see. Any
// pairs not checked yet, or that couldn't be, are said too.
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
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>

	return (
		<section
			id="coverage"
			aria-labelledby="coverage-title"
			className={cn('bg-surface border-border rounded-lg border p-6 md:p-7', className)}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<h2 id="coverage-title" className="text-text-muted type-eyebrow">
					{t('checkedLabel')}
				</h2>
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="text-text-muted hover:text-text hover:bg-surface-hover -mt-2 -mr-2 inline-flex h-9 items-center gap-1 rounded-sm px-2 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11"
						>
							<QuestionIcon size={15} />
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
						{suggestedType != null && (
							<p className="text-text-muted mt-2">
								{t('coverageSuggested', { type: suggestedType })}
							</p>
						)}
					</PopoverContent>
				</Popover>
			</div>
			<p className="mt-3 flex flex-wrap items-baseline gap-x-2">
				<Count
					value={coverage.assessed}
					className="text-text font-mono text-[2.5rem] leading-none font-semibold tracking-[-0.03em]"
				/>
				<span className="text-text-body text-base">
					{t('checkedByJev', { count: coverage.assessed })}
				</span>
			</p>
			<p className="text-text-muted mt-2 text-sm">
				{t.rich(
					'checkedSources',
					{
						suggested: coverage.suggested,
						added: coverage.addedByVendor,
						notCompared: coverage.notCompared,
						n: mono
					},
					EXACT_FORMATS
				)}
			</p>
			{coverage.pending + coverage.failed > 0 && (
				<p className="text-text-muted mt-1 text-sm">
					{t.rich(
						'checkedUnfinished',
						{ pending: coverage.pending, failed: coverage.failed, n: mono },
						EXACT_FORMATS
					)}
				</p>
			)}
			<p className="text-text-muted mt-3 text-sm">{t('coverageFootnote')}</p>
		</section>
	)
}
