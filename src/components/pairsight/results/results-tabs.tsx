import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'

// Overview and Detailed analysis. They're links (the tab lives in the URL,
// so the server renders the right one and Back works), styled as tabs; the
// detailed tab carries the number of pairs its filters match.
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
	const tabs = [
		{ key: 'overview', label: t('tabOverview'), href: overviewHref },
		{ key: 'detailed', label: t('tabDetailed'), href: detailedHref }
	] as const
	return (
		<nav aria-label={t('views')} className="border-border mt-5 flex gap-5 border-b">
			{tabs.map((item) => {
				const isCurrent = item.key === tab
				return (
					<Link
						key={item.key}
						href={item.href}
						aria-current={isCurrent ? 'page' : undefined}
						className={cn(
							'-mb-px flex h-10 items-center gap-2 border-b-2 text-sm font-medium transition-colors duration-150',
							isCurrent
								? 'border-action text-text'
								: 'text-text-muted hover:text-text border-transparent'
						)}
					>
						{item.label}
						{item.key === 'detailed' && (
							<span
								className={cn(
									'rounded-[5px] px-1.5 font-mono text-[0.6875rem]',
									isCurrent ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-text-muted'
								)}
							>
								{detailedCount}
							</span>
						)}
					</Link>
				)
			})}
		</nav>
	)
}
