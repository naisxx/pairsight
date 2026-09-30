'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, RetryIcon, SpinnerIcon } from '@/components/ui/icons'
import type { RunProgress } from '@/server/pairsight/runs'
import { ActionBar } from '../step-layout'

// The run's action bar: resume after a configuration stop, retry failed pairs
// once complete, and the stage's primary action, View results.
export function RunActions({
	progress,
	resultsHref,
	isActing,
	onRetryFailed,
	onResume
}: {
	progress: RunProgress
	resultsHref: string
	isActing: boolean
	onRetryFailed: () => void
	onResume: () => void
}) {
	const t = useTranslations('Run')
	const isComplete = progress.status === 'completed'
	return (
		<ActionBar
			hint={
				progress.status === 'running' ? (
					<span className="flex items-center gap-1.5">
						<InfoIcon />
						{t('keepOpen')}
					</span>
				) : undefined
			}
		>
			{progress.status === 'stopped' && (
				<Button variant="outline" onClick={onResume} disabled={isActing}>
					{isActing ? <SpinnerIcon /> : <RetryIcon />}
					{t('resume')}
				</Button>
			)}
			{isComplete && progress.failed > 0 && (
				<Button variant="outline" onClick={onRetryFailed} disabled={isActing}>
					{isActing ? <SpinnerIcon /> : <RetryIcon />}
					{isActing ? t('retrying') : t('retryFailed')}
				</Button>
			)}
			<Button asChild disabled={!isComplete}>
				<Link
					href={resultsHref}
					aria-disabled={!isComplete}
					className={isComplete ? undefined : 'pointer-events-none opacity-50'}
				>
					{t('viewResults')}
					<ArrowRightIcon />
				</Link>
			</Button>
		</ActionBar>
	)
}
