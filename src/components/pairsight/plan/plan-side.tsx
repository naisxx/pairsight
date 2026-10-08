import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ShieldIcon } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { thresholdPreset } from '@/lib/pairsight/decisions'
import { CutoffScale } from '../cutoff-scale'
import type { IdentityRole } from '@/server/pairsight/fields'

const ICON_SIZE = 15

// Beside the flow, two cards of the same height: the cut-off the run will
// keep (drawn on Jev's 0–1 scale), and what Jev is sent and never sees.
export async function PlanSide({
	jevFields,
	threshold,
	rulesHref
}: {
	jevFields: IdentityRole[]
	threshold: number
	rulesHref: string
}) {
	const [t, tRoles, tRules] = await Promise.all([
		getTranslations('Plan'),
		getTranslations('Roles'),
		getTranslations('Rules')
	])
	const preset = thresholdPreset(threshold)
	return (
		<div className="grid grid-cols-1 gap-4 @3xl:grid-cols-12">
			<section
				aria-labelledby="threshold-plan-title"
				className="border-border bg-surface flex flex-col rounded-lg border p-5 md:p-6 @3xl:col-span-5"
			>
				<div className="flex items-start justify-between gap-3">
					<h2 id="threshold-plan-title" className="type-heading flex items-center gap-1">
						{t('thresholdTitle')}
					</h2>
					<Link
						href={rulesHref}
						className="text-accent-ink type-ui hit-area shrink-0 font-medium hover:underline"
					>
						{t('thresholdChange')}
					</Link>
				</div>
				<p className="mt-4 flex items-baseline gap-2">
					<span className="font-mono text-4xl leading-none font-medium tracking-[-0.03em]">
						{threshold.toFixed(2)}
					</span>
					<span className="type-ui text-text-muted">
						{preset == null ? tRules('thresholdCustom') : tRules(`threshold_${preset}`)}
					</span>
				</p>
				<p className="text-text-muted type-ui mt-3 leading-relaxed">{t('thresholdNote')}</p>
				{/* Where the line sits on Jev's 0–1 score scale. */}
				<div className="mt-auto pt-5">
					<CutoffScale value={threshold} />
				</div>
			</section>
			<section
				aria-labelledby="sent-title"
				className="border-border bg-surface flex flex-col rounded-lg border p-5 md:p-6 @3xl:col-span-7"
			>
				<h2 id="sent-title" className="type-heading flex items-center gap-1">
					{t('jevSeesTitle')}
					<InfoTip
						label={t('jevSeesInfoLabel')}
						content={`${t('jevSeesDescription')} ${t('sentToJev')}`}
					/>
				</h2>
				<p className="text-text-muted type-ui mt-0.5">
					{t('jevSeesCount', { count: jevFields.length })}
				</p>
				<ul className="mt-4 flex flex-wrap gap-1.5">
					{jevFields.map((field) => (
						<li
							key={field}
							className="border-border bg-surface-muted rounded-full border px-2.5 py-0.5 text-xs"
						>
							{tRoles(field)}
						</li>
					))}
				</ul>
				<p className="border-border mt-auto flex items-start gap-2 border-t pt-4 text-xs">
					<ShieldIcon size={ICON_SIZE} className="text-text-muted mt-px shrink-0" />
					<span>
						<span className="font-medium">{t('notSentTitle')}</span>{' '}
						<span className="text-text-muted">{t('notSentBody')}</span>
					</span>
				</p>
			</section>
		</div>
	)
}
