import { LOW_CONFIDENCE_BAND } from '@/lib/pairsight/decisions'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { PreviewNote } from '../preview-note'
import type { Workload } from '@/lib/pairsight/metrics'
import type { ResultRow } from '@/server/pairsight/results'
import { cn } from '@/lib/cn'
import { Glyph, type GlyphKind } from '../../glyph'

const ARROW_SIZE = 18
const SCORE_DIGITS = 2

type Href = { pathname: string; query: Record<string, string> }

function mono(chunks: React.ReactNode) {
	return <strong className="text-text font-mono font-semibold">{chunks}</strong>
}

// A few pairs of one kind, surest first: each row its tile, its name, the two
// record IDs and Jev's score, opening the pair.
function PairGroup({
	title,
	hint,
	rows,
	kind,
	pairHref,
	className
}: {
	title: string
	hint: string
	rows: ResultRow[]
	kind: GlyphKind
	pairHref: (pairId: string) => Href
	className?: string
}) {
	const t = useTranslations('Overview')
	return (
		<div className={className}>
			<h3 className="text-text font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">
				{title}
			</h3>
			<p className="text-text-muted mt-1 mb-2 text-sm">{hint}</p>
			{rows.length === 0 ? (
				<p className="border-border text-text-muted border-t py-3.5 text-sm">
					{t('noneAtThreshold')}
				</p>
			) : (
				<ul>
					{rows.map((row) => (
						<li key={row.id} className="border-border border-t py-0.5">
							{/* The hover fill reaches 12px past the text on each side, so
							    the row reads as padded while it lines up with the heading. */}
							<Link
								href={pairHref(row.id)}
								className="hover:bg-surface-muted -mx-3 grid min-h-[52px] grid-cols-[36px_minmax(0,1fr)_auto_56px] items-center gap-4 rounded-md px-3 font-mono text-sm transition-[background-color] duration-150"
							>
								<Glyph kind={kind} />
								<span className="text-text truncate font-sans text-base">
									{row.recordA.label}
									{row.recordB.label !== row.recordA.label && (
										<span className="sr-only"> ↔ {row.recordB.label}</span>
									)}
								</span>
								<span className="text-text-muted hidden truncate sm:block">
									{row.recordA.reference} · {row.recordB.reference}
								</span>
								<span className="text-text text-right font-semibold tracking-[-0.03em]">
									{row.score?.toFixed(SCORE_DIGITS)}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

// Where to start, for the vendor the page describes: the duplicates it missed
// that Jev is surest about, its merges Jev doubts most, the close calls a
// small change of cut-off would flip (and any pairs Jev couldn't check), then
// the way into every disagreement.
export function LookFirst({
	vendorName,
	threshold,
	missed,
	merges,
	workload,
	hrefs,
	pairHref,
	className
}: {
	vendorName: string
	threshold: number
	missed: ResultRow[]
	merges: ResultRow[]
	workload: Workload
	hrefs: { disagreements: string; near: string; incomplete: string }
	pairHref: (pairId: string) => Href
	className?: string
}) {
	const t = useTranslations('Overview')
	const lineLink =
		'decoration-border-strong hover:decoration-text underline-offset-[3px] hover:underline'

	return (
		<section
			id="top"
			aria-labelledby="top-title"
			className={cn('bg-surface border-border rounded-lg border p-6 md:p-7', className)}
		>
			<h2 id="top-title" className="text-text-muted type-eyebrow">
				{t('lookFirstLabel', { vendor: vendorName })}
			</h2>
			<PreviewNote runThreshold={threshold} message="panel" className="mt-2" />
			<PairGroup
				title={t('missedTitle')}
				hint={t('missedHint')}
				rows={missed}
				kind="same"
				pairHref={pairHref}
				className="mt-4"
			/>
			<PairGroup
				title={t('mergesTitle')}
				hint={t('mergesHint')}
				rows={merges}
				kind="different"
				pairHref={pairHref}
				className="mt-7"
			/>
			<div className="border-border text-text-body mt-5 flex flex-col gap-1.5 border-t pt-4 text-base">
				<p>
					<Link href={hrefs.near} className={lineLink}>
						{t.rich('closeCalls', {
							count: workload.nearThreshold,
							band: LOW_CONFIDENCE_BAND.toFixed(SCORE_DIGITS),
							n: mono
						})}
					</Link>
				</p>
				{workload.incomplete > 0 && (
					<p>
						<Link href={hrefs.incomplete} className={lineLink}>
							{t.rich('incompleteLine', { count: workload.incomplete, n: mono })}
						</Link>
					</p>
				)}
			</div>
			{workload.disagreements > 0 && (
				<Button asChild cap={<ArrowRightIcon size={ARROW_SIZE} />} className="mt-5">
					<Link href={hrefs.disagreements}>
						{t('reviewAll', { count: workload.disagreements })}
					</Link>
				</Button>
			)}
		</section>
	)
}
