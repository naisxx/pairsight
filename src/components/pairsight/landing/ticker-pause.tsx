'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PauseIcon, PlayIcon } from '@/components/ui/icons'

const ICON_SIZE = 16

// Stops the ticker's rows and starts them again (WCAG 2.2.2: moving content
// a visitor can pause). The rows read `data-paused` on the ticker; hidden
// where nothing moves.
export function TickerPause() {
	const t = useTranslations('HomePage')
	const [isPaused, setIsPaused] = useState(false)
	return (
		<button
			type="button"
			aria-pressed={isPaused}
			aria-label={t('tickerPause')}
			onClick={(event) => {
				const next = !isPaused
				setIsPaused(next)
				event.currentTarget.closest('[data-ticker]')?.toggleAttribute('data-paused', next)
			}}
			className="landing-ticker-pause landing-press bg-surface border-border text-text hover:bg-surface-muted absolute top-1/2 right-4 z-[1] size-11 -translate-y-1/2 items-center justify-center rounded-full border md:right-8"
		>
			{isPaused ? <PlayIcon size={ICON_SIZE} /> : <PauseIcon size={ICON_SIZE} />}
		</button>
	)
}
