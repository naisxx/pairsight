import { useTranslations } from 'next-intl'
import { Count } from '@/components/ui/count'
import { DockLink } from '../shell/dock'

// Overview and Pairs, in the dock. They're links (the tab lives in the URL,
// so the server renders the right one and Back works); Pairs carries the
// number of pairs its filters match.
export function ResultsTabs({
	tab,
	overviewHref,
	detailedHref,
	detailedCount
}: {
	tab: 'overview' | 'detailed'
	overviewHref: { pathname: string; query: Record<string, string> }
	detailedHref: { pathname: string; query: Record<string, string> }
	detailedCount: number
}) {
	const t = useTranslations('Results')
	return (
		<span role="group" aria-label={t('views')} className="flex flex-wrap items-center gap-1.5">
			<DockLink href={overviewHref} isCurrent={tab === 'overview'}>
				{t('tabOverview')}
			</DockLink>
			<DockLink
				href={detailedHref}
				isCurrent={tab === 'detailed'}
				count={<Count value={detailedCount} />}
			>
				{t('tabDetailed')}
			</DockLink>
		</span>
	)
}
