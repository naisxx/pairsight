import { useTranslations } from 'next-intl'
import { AnimatedPercent } from '@/components/ui/animated-number'
import { Chip } from '@/components/ui/chip'
import { WarningCircleIcon } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'

type MetricKey = 'precision' | 'recall' | 'f1'
const KEYS: MetricKey[] = ['precision', 'recall', 'f1']
const PERCENT = 100

function formatShare(value: number | null, emptyLabel: string) {
	return value == null ? emptyLabel : `${(value * PERCENT).toFixed(1)}%`
}

// Precision, recall and F1 for the selected vendor, labelled as AI-estimated
// on evaluated pairs only. Other vendors show as ticks on each bar.
export function MetricStrip({
	vendorName,
	metrics,
	others,
	className
}: {
	vendorName: string
	metrics: VendorMetrics
	others: Array<{ name: string; metrics: VendorMetrics }>
	className?: string
}) {
	const t = useTranslations('Overview')
	const notAvailable = t('notAvailable')
	const isProvisional = metrics.counts.incomplete > 0
	const lines: Record<MetricKey, { detail: React.ReactNode; meaning: string }> = {
		precision: {
			detail: t.rich('precisionDetail', {
				agreed: metrics.tp,
				matched: metrics.tp + metrics.fp,
				vendor: vendorName,
				n: (chunks) => <span className="text-text font-mono">{chunks}</span>
			}),
			meaning:
				metrics.precision == null
					? t('precisionEmpty')
					: t('precisionMeaning', { count: metrics.fp })
		},
		recall: {
			detail: t.rich('recallDetail', {
				found: metrics.tp,
				reference: metrics.tp + metrics.fn,
				n: (chunks) => <span className="text-text font-mono">{chunks}</span>
			}),
			meaning: metrics.recall == null ? t('recallEmpty') : t('recallMeaning', { count: metrics.fn })
		},
		f1: { detail: t('f1Detail'), meaning: t('f1Meaning') }
	}

	return (
		<section
			aria-labelledby="metrics-title"
			className={cn('border-border bg-surface rounded-md border', className)}
		>
			<header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
				<h2 id="metrics-title" className="type-subheading">
					{t('metricsTitle', { vendor: vendorName })}
				</h2>
				<div className="flex items-center gap-2">
					<span className="text-text-muted text-xs">{t('aiEstimated')}</span>
					{isProvisional && (
						<Chip tone="warning" icon={<WarningCircleIcon size={13} />}>
							{t('provisional')}
						</Chip>
					)}
				</div>
			</header>
			<div className="divide-border grid grid-cols-1 divide-y @2xl:grid-cols-3 @2xl:divide-x @2xl:divide-y-0">
				{KEYS.map((key) => {
					const value = metrics[key]
					return (
						<div key={key} className="px-4 pt-3 pb-4">
							<div className="text-text-muted type-ui flex items-center gap-1">
								{t(`${key}Label`)}
								<InfoTip
									label={t('whatIs', { metric: t(`${key}Label`) })}
									content={t(`${key}Tip`, { vendor: vendorName })}
								/>
							</div>
							<AnimatedPercent
								value={value}
								emptyLabel={notAvailable}
								className="text-text mt-1 block font-mono text-[32px] leading-none font-medium tracking-[-0.02em]"
							/>
							<div className="mt-3">
								<div aria-hidden className="bar-wipe bg-surface-muted relative h-1.5 rounded-full">
									<div
										className="bg-text absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
										style={{ width: `${(value ?? 0) * PERCENT}%` }}
									/>
									{others.map((other) =>
										other.metrics[key] == null ? null : (
											<span
												key={other.name}
												className="bg-series-b absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full transition-[left] duration-300 ease-out"
												style={{ left: `${(other.metrics[key] ?? 0) * PERCENT}%` }}
											/>
										)
									)}
								</div>
								{others.length > 0 && (
									<p className="text-text-muted type-caption mt-1.5 flex flex-wrap gap-x-3">
										{others.map((other) => (
											<span key={other.name} className="inline-flex items-center gap-1">
												<span aria-hidden className="bg-series-b h-2 w-[2px] rounded-full" />
												{other.name}{' '}
												<span className="text-text font-mono">
													{formatShare(other.metrics[key], notAvailable)}
												</span>
											</span>
										))}
									</p>
								)}
							</div>
							<p className="text-text-muted mt-2 text-xs">{lines[key].detail}</p>
							<p className="text-text mt-0.5 text-xs">{lines[key].meaning}</p>
						</div>
					)
				})}
			</div>
			{isProvisional && (
				<p className="border-border text-text-muted border-t px-4 py-2.5 text-xs">
					{t('provisionalNote', { count: metrics.counts.incomplete })}
				</p>
			)}
		</section>
	)
}
