import { getTranslations } from 'next-intl/server'
import { InfoIcon, ShieldIcon, ShowIcon } from '@/components/ui/icons'
import type { PlanCounts } from '@/server/pairsight/plan'
import type { IdentityRole } from '@/server/pairsight/fields'

const ICON_SIZE = 15
const TITLE_ICON_SIZE = 16

// What Jev is sent (and isn't), and the promise that every vendor-matched
// pair is assessed, inside the rules or not.
export async function PlanSide({
	jevFields,
	counts
}: {
	jevFields: IdentityRole[]
	counts: PlanCounts | null
}) {
	const [t, tRoles] = await Promise.all([getTranslations('Plan'), getTranslations('Roles')])
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	return (
		<div className="space-y-4">
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
