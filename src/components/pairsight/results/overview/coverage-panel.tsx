import { useTranslations } from 'next-intl'
import { QuestionIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ResultsOverview } from '@/server/pairsight/result-overview'

const PERCENT = 100

// What was and wasn't assessed: the planned pairs by status, where they came
// from, and the possible pairs nobody compared (the blind spot recall can't see).
export function CoveragePanel({
	coverage,
	className
}: {
	coverage: ResultsOverview['coverage']
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
								fromRules: coverage.fromRules,
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
				<span className="font-mono text-[26px] leading-none font-medium">{coverage.assessed}</span>
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
						{t(`status.${key}`)} <span className="text-text font-mono">{count}</span>
					</li>
				))}
			</ul>
			<dl className="border-border type-ui mt-4 flex flex-col gap-1.5 border-t pt-3">
				{(
					[
						['fromRules', coverage.fromRules],
						['addedByVendor', coverage.addedByVendor],
						['notCompared', coverage.notCompared]
					] as const
				).map(([key, count]) => (
					<div key={key} className="flex justify-between gap-3">
						<dt className="text-text-muted">{t(`coverage.${key}`)}</dt>
						<dd className="font-mono">{count}</dd>
					</div>
				))}
			</dl>
			<p className="text-text-muted mt-3 text-xs leading-relaxed">{t('coverageFootnote')}</p>
		</Panel>
	)
}
