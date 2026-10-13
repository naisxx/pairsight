import { useTranslations } from 'next-intl'
import type { FieldPatterns } from '@/server/pairsight/result-overview'
import { cn } from '@/lib/cn'
import { Glyph, type GlyphKind } from '../../glyph'

// The reading of the field patterns, in a sentence each: what the pairs the
// vendor missed have in common (ice equals), and what its doubtful merges
// share (vermilion not-equals).
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

	const readings: Array<{ kind: GlyphKind; text: string }> = []
	const missed = patterns.summary.pairsight_only
	if (missed != null) {
		readings.push({
			kind: 'same',
			text:
				missed.different.length > 0
					? t('patternMissedDiffer', {
							shared: list(missed.shared),
							different: list(missed.different),
							vendor: vendorName
						})
					: t('patternMissed', { shared: list(missed.shared), vendor: vendorName })
		})
	}
	const merged = patterns.summary.vendor_only
	if (merged != null) {
		readings.push({
			kind: 'different',
			text:
				merged.different.length > 0
					? t('patternMergedDiffer', {
							shared: list(merged.shared),
							different: list(merged.different),
							vendor: vendorName
						})
					: t('patternMerged', { shared: list(merged.shared), vendor: vendorName })
		})
	}

	return (
		<section
			id="why"
			aria-labelledby="why-title"
			className={cn(
				'bg-surface border-border flex flex-wrap gap-x-12 gap-y-4 rounded-lg border p-6 md:p-7',
				className
			)}
		>
			<h2 id="why-title" className="text-text-muted type-eyebrow shrink-0 grow-0 basis-[200px]">
				{t('whyLabel')}
			</h2>
			{readings.length === 0 ? (
				<p className="text-text-body flex-[1_1_320px] text-base">{t('whyEmpty')}</p>
			) : (
				readings.map((reading) => (
					<p key={reading.text} className="text-text-body flex-[1_1_320px] text-base">
						<Glyph kind={reading.kind} className="mr-2 align-middle" />
						{reading.text}
					</p>
				))
			)}
		</section>
	)
}
