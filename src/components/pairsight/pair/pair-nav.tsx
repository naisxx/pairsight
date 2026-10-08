import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import { exactTitle } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'

type Href = { pathname: string; query: Record<string, string> }

// Back to the (still filtered) results, where this pair sits in the list, and
// previous/next — the same moves Esc, K and J make.
export function PairNav({
	resultsHref,
	previousHref,
	nextHref,
	position,
	total,
	isInFiltered
}: {
	resultsHref: Href
	previousHref: Href | null
	nextHref: Href | null
	position: number | null
	total: number
	isInFiltered: boolean
}) {
	const t = useTranslations('Pair')
	const step = (href: Href | null, label: string, keys: string, content: React.ReactNode) => (
		<Button asChild variant="secondary" size="sm" aria-label={label}>
			<Link
				href={href ?? resultsHref}
				aria-keyshortcuts={keys}
				aria-disabled={href == null}
				className={cn(href == null && 'pointer-events-none opacity-50')}
			>
				{content}
			</Link>
		</Button>
	)
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<Button asChild variant="quiet" size="sm" className="-ml-2">
				<Link href={resultsHref} aria-keyshortcuts="Escape">
					<ArrowLeftIcon size={15} />
					{t('back')}
					<span className="hidden @2xl:inline-flex">
						<Kbd>Esc</Kbd>
					</span>
				</Link>
			</Button>
			<div className="flex items-center gap-2">
				{position != null && (
					<span
						className="text-text-muted type-ui"
						title={exactTitle([position, total], () =>
							t.markup(
								isInFiltered ? 'positionFiltered' : 'positionAll',
								{ position, total, n: (chunks) => chunks },
								EXACT_FORMATS
							)
						)}
					>
						{t.rich(isInFiltered ? 'positionFiltered' : 'positionAll', {
							position,
							total,
							n: (chunks) => <span className="text-text font-mono">{chunks}</span>
						})}
					</span>
				)}
				{step(
					previousHref,
					t('previousShortcut'),
					'K',
					<>
						<ChevronLeftIcon size={14} />
						<span className="hidden @2xl:inline">{t('previous')}</span>
						<span className="hidden @3xl:inline-flex">
							<Kbd>K</Kbd>
						</span>
					</>
				)}
				{step(
					nextHref,
					t('nextShortcut'),
					'J',
					<>
						<span className="hidden @2xl:inline">{t('next')}</span>
						<span className="hidden @3xl:inline-flex">
							<Kbd>J</Kbd>
						</span>
						<ChevronRightIcon size={14} />
					</>
				)}
			</div>
		</div>
	)
}
