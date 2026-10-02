'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, PlayIcon, SpinnerIcon } from '@/components/ui/icons'
import type { RunProgress } from '@/server/pairsight/runs'
import { ActionBar } from '../step-layout'
import { ReadOnlyGate } from '../read-only'

const ICON_SIZE = 15

// The run's action bar: Back to the plan, Resume when pairs are left
// waiting, and the stage's primary action, View results, once it's complete.
// Retry failed lives in the run card, next to why the pairs failed.
export function RunActions({
	progress,
	resultsHref,
	backHref,
	isActing,
	onResume
}: {
	progress: RunProgress
	resultsHref: string
	backHref: string
	isActing: boolean
	onResume: () => void
}) {
	const t = useTranslations('Run')
	const isComplete = progress.status === 'completed'
	// Stopped for configuration, or completed while a later run (which shares
	// its judgments) put some of its failed pairs back in the queue.
	const canResume =
		progress.status === 'stopped' || (isComplete && progress.pending + progress.running > 0)
	return (
		<ActionBar back={{ href: backHref, label: t('back') }}>
			{canResume && (
				<ReadOnlyGate action="run">
					<Button
						variant={isComplete ? 'secondary' : 'primary'}
						onClick={onResume}
						disabled={isActing}
					>
						{t('resume')}
						{isActing ? (
							<SpinnerIcon size={ICON_SIZE} />
						) : (
							<PlayIcon size={ICON_SIZE} variant="solid" />
						)}
					</Button>
				</ReadOnlyGate>
			)}
			{(isComplete || !canResume) && (
				<Button asChild disabled={!isComplete}>
					<Link
						href={resultsHref}
						aria-disabled={!isComplete}
						className={isComplete ? undefined : 'pointer-events-none opacity-50'}
					>
						{t('viewResults')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Link>
				</Button>
			)}
		</ActionBar>
	)
}
