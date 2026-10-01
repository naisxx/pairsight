'use client'

import { useTranslations } from 'next-intl'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// What the comparison set covers and what it can't see, behind a link so the
// coverage line stays one sentence.
export function CoverageHelp() {
	const t = useTranslations('Results')
	return (
		<Popover>
			<PopoverTrigger className="text-accent-ink type-label focus-visible:outline-ring rounded hover:underline focus-visible:outline-2">
				{t('coverageHowTitle')}
			</PopoverTrigger>
			<PopoverContent align="start" className="flex w-80 flex-col gap-2">
				<h2 className="text-text type-subheading">{t('coverageHowTitle')}</h2>
				<p className="text-text type-body">{t('coverageHowRules')}</p>
				<p className="text-text type-body">{t('coverageHowBlindSpot')}</p>
			</PopoverContent>
		</Popover>
	)
}
