import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { InfoIcon, ShieldIcon, ShowIcon, SlidersIcon } from '@/components/ui/icons'
import { thresholdPreset } from '@/lib/pairsight/decisions'
import type { PlanCounts } from '@/server/pairsight/plan'
import type { IdentityRole } from '@/server/pairsight/fields'

const ICON_SIZE = 15
const TITLE_ICON_SIZE = 16

// The threshold the run will keep, what Jev is sent (and isn't), and the
// promise that every vendor-matched pair is assessed, inside the rules or not.
export async function PlanSide({
	jevFields,
	counts,
	threshold,
	rulesHref
}: {
	jevFields: IdentityRole[]
	counts: PlanCounts | null
	threshold: number
	rulesHref: string
}) {
	const [t, tRoles, tRules] = await Promise.all([
		getTranslations('Plan'),
		getTranslations('Roles'),
		getTranslations('Rules')
	])
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const preset = thresholdPreset(threshold)
	return (
		<div className="space-y-4">
			<section
				aria-labelledby="threshold-plan-title"
				className="border-border bg-surface rounded-md border p-5"
			>
				<div className="flex items-start justify-between gap-3">
					<h2 id="threshold-plan-title" className="flex items-center gap-2 text-sm font-semibold">
						<SlidersIcon size={TITLE_ICON_SIZE} className="text-text-muted" />
						{t('thresholdTitle')}
					</h2>
					<Link
						href={rulesHref}
						className="text-accent-ink type-ui shrink-0 font-medium hover:underline"
					>
						{t('thresholdChange')}
					</Link>
				</div>
				<p className="mt-2 flex items-baseline gap-2">
					<span className="font-mono text-2xl font-medium">{threshold.toFixed(2)}</span>
					<span className="type-ui text-text-muted">
						{preset == null ? tRules('thresholdCustom') : tRules(`threshold_${preset}`)}
					</span>
				</p>
				<p className="text-text-muted mt-1 text-xs">{t('thresholdNote')}</p>
			</section>
			<section
				aria-labelledby="sent-title"
				className="border-border bg-surface rounded-md border p-5"
			>
				<h2 id="sent-title" className="flex items-center gap-2 text-sm font-semibold">
					<ShowIcon size={TITLE_ICON_SIZE} className="text-text-muted" />
					{t('jevSeesTitle')}
				</h2>
				<p className="text-text-muted mt-1 text-xs">{t('jevSeesDescription')}</p>
				<ul className="mt-3 flex flex-wrap gap-1.5">
					{jevFields.map((field) => (
						<li
							key={field}
							className="border-border bg-surface-muted rounded-[6px] border px-2 py-0.5 text-xs"
						>
							{tRoles(field)}
						</li>
					))}
				</ul>
				<p className="bg-surface-muted mt-4 flex items-start gap-2 rounded-sm p-3 text-xs">
					<ShieldIcon size={ICON_SIZE} className="text-text-muted mt-px shrink-0" />
					<span>
						<span className="font-medium">{t('notSentTitle')}</span>{' '}
						<span className="text-text-muted">{t('notSentBody')}</span>
					</span>
				</p>
				<p className="text-text-muted mt-3 flex items-center gap-1.5 text-xs">
					<InfoIcon size={ICON_SIZE} className="shrink-0" />
					{t('sentToJev')}
				</p>
			</section>
			{counts != null && (
				<section
					aria-labelledby="included-title"
					className="border-border bg-surface rounded-md border p-5"
				>
					<h2 id="included-title" className="text-sm font-semibold">
						{t('includedTitle')}
					</h2>
					<p className="type-ui text-text-muted mt-1 leading-relaxed">
						{t.rich('included', {
							inside: counts.vendorPairs - counts.addedByVendorOnly,
							vendorPairs: counts.vendorPairs,
							outside: counts.addedByVendorOnly,
							n: mono
						})}
					</p>
				</section>
			)}
		</div>
	)
}
