import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
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
		<Button asChild variant="secondary" aria-label={label}>
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
			<Link
				href={resultsHref}
				aria-keyshortcuts="Escape"
				className="text-text decoration-border-strong hover:decoration-text inline-flex min-h-11 items-center gap-2 underline underline-offset-[3px] transition-[text-decoration-color] duration-150"
			>
				{t('back')}
				<span className="hidden no-underline @2xl:inline-flex">
					<Kbd>Esc</Kbd>
				</span>
			</Link>
			<div className="flex flex-wrap items-center gap-2">
				{position != null && (
					<span
						className="text-text-muted text-sm"
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
							n: (chunks) => <span className="font-mono">{chunks}</span>
						})}
					</span>
				)}
				{step(
					previousHref,
					t('previousShortcut'),
					'K',
					<>
						<span className="@2xl:hidden">
							<ChevronLeftIcon size={16} />
						</span>
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
						<span className="@2xl:hidden">
							<ChevronRightIcon size={16} />
						</span>
					</>
				)}
			</div>
		</div>
	)
}
