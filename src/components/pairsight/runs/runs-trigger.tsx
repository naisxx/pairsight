'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PlayIcon, SpinnerIcon } from '@/components/ui/icons'
import { useRunsCentre } from './runs-centre'

const ICON_SIZE = 16

// The Runs centre's way in, in the top bar on every app page: a spinner and a
// count while runs are going, otherwise just "Runs".
export function RunsTrigger() {
	const t = useTranslations('Runs')
	const { activeCount, open } = useRunsCentre()
	const isActive = activeCount > 0
	return (
		<Button
			variant="quiet"
			onClick={() => open()}
			aria-label={isActive ? t('triggerActive', { count: activeCount }) : t('trigger')}
		>
			{isActive ? (
				<SpinnerIcon size={ICON_SIZE} className="text-info" />
			) : (
				<PlayIcon size={ICON_SIZE} />
			)}
			<span className="hidden sm:inline">{t('triggerLabel')}</span>
			{isActive && (
				<span className="bg-info-subtle text-info rounded-full px-1.5 font-mono text-xs">
					{activeCount}
				</span>
			)}
		</Button>
	)
}
