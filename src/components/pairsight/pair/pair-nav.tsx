import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

type Href = { pathname: string; query: Record<string, string> }

// Back to the (still filtered) results, the position in that list, and
// previous/next — the same moves J/K/Esc make.
export function PairNav({
	resultsHref,
	previousHref,
	nextHref,
	position,
	total
}: {
	resultsHref: Href
	previousHref: Href | null
	nextHref: Href | null
	position: number | null
	total: number
}) {
	const t = useTranslations('Pair')
	const step = (href: Href | null, label: string, icon: React.ReactNode) => (
		<Button asChild variant="outline" size="sm" aria-label={label}>
			<Link
				href={href ?? resultsHref}
				aria-disabled={href == null}
				className={cn(href == null && 'pointer-events-none opacity-50')}
			>
				{icon}
			</Link>
		</Button>
	)
	return (
		<div className="mb-5 flex flex-wrap items-center gap-3">
			<Button asChild variant="ghost" size="sm">
				<Link href={resultsHref}>
					<ArrowLeftIcon />
					{t('back')}
				</Link>
			</Button>
			{position != null && (
				<span className="text-text-muted text-sm tabular-nums">
					{t('position', { position, total })}
				</span>
			)}
			<div className="ml-auto flex gap-2">
				{step(previousHref, t('previous'), <ChevronLeftIcon />)}
				{step(nextHref, t('next'), <ChevronRightIcon />)}
			</div>
		</div>
	)
}
