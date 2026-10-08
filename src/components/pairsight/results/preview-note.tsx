'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { useCutoffPreview } from './cutoff-preview'

// While another cut-off is previewed, says plainly what doesn't follow it:
// lists, pairs and the panels read from them stay at the run's own cut-off.
// Nothing (and no space taken) otherwise.
export function PreviewNote({
	runThreshold,
	message,
	className
}: {
	runThreshold: number
	message: 'lists' | 'panel'
	className?: string
}) {
	const t = useTranslations('Results')
	const { isPreviewing } = useCutoffPreview(runThreshold)
	if (!isPreviewing) return null
	return (
		<p className={cn('text-accent-ink text-xs font-medium', className)}>
			{t(message === 'lists' ? 'previewListsNote' : 'previewPanelNote', {
				value: runThreshold.toFixed(2)
			})}
		</p>
	)
}
