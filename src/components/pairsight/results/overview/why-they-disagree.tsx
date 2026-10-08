import { useTranslations } from 'next-intl'
import { InsightIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import type { FieldPatterns } from '@/server/pairsight/result-overview'

// The reading of the field patterns, in a sentence each: what the pairs the
// vendor missed have in common, and what its doubtful merges share.
export function WhyTheyDisagree({
	vendorName,
	patterns,
	className
}: {
	vendorName: string
	patterns: FieldPatterns
	className?: string
}) {
	const t = useTranslations('Overview')
	const tRoles = useTranslations('Roles')
	const list = (roles: string[]) => roles.map((role) => tRoles(role)).join(t('and'))

	const readings: string[] = []
	const missed = patterns.summary.pairsight_only
	if (missed != null) {
		readings.push(
			missed.different.length > 0
				? t('patternMissedDiffer', {
						shared: list(missed.shared),
						different: list(missed.different),
						vendor: vendorName
					})
				: t('patternMissed', { shared: list(missed.shared), vendor: vendorName })
		)
	}
	const merged = patterns.summary.vendor_only
	if (merged != null) {
		readings.push(
			merged.different.length > 0
				? t('patternMergedDiffer', {
						shared: list(merged.shared),
						different: list(merged.different),
						vendor: vendorName
					})
				: t('patternMerged', { shared: list(merged.shared), vendor: vendorName })
		)
	}

	return (
		<Panel id="why" title={t('whyTitle')} description={t('whyDescription')} className={className}>
			{readings.length === 0 ? (
				<p className="text-text-muted type-ui">{t('whyEmpty')}</p>
			) : (
				<ul className="flex flex-col gap-4">
					{readings.map((reading) => (
						<li
							key={reading}
							className="text-text flex items-start gap-3 text-[0.9375rem] leading-relaxed"
						>
							<span className="bg-accent text-accent-ink mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
								<InsightIcon size={15} />
							</span>
							{reading}
						</li>
					))}
				</ul>
			)}
		</Panel>
	)
}
