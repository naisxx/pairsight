'use client'

import { useTranslations } from 'next-intl'
import { InfoTip } from '@/components/ui/info-tip'
import { Switch } from '@/components/ui/switch'

// Whether the Plan adds the pairs Splink picked to the ones your rules pick
// (src/server/pairsight/splink/picks.ts). Splink only picks; Jev still judges.
export function SplinkSwitch({
	isOn,
	onChange
}: {
	isOn: boolean
	onChange: (isOn: boolean) => void
}) {
	const t = useTranslations('Rules')
	const tPlan = useTranslations('Plan')
	return (
		<section
			aria-labelledby="splink-title"
			className="border-border bg-surface flex items-start gap-3 rounded-md border px-5 py-4"
		>
			<div className="pt-0.5">
				<Switch
					id="splink-picks"
					checked={isOn}
					onCheckedChange={onChange}
					aria-labelledby="splink-title"
				/>
			</div>
			<div className="min-w-0">
				<h2 id="splink-title" className="flex items-center gap-1 text-sm font-semibold">
					{t('splinkTitle')}
					<InfoTip label={tPlan('splinkInfoLabel')} content={tPlan('splinkInfo')} />
				</h2>
				<p className="type-ui text-text-muted mt-0.5">{t('splinkDescription')}</p>
			</div>
		</section>
	)
}
