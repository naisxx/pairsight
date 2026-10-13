import { cn } from '@/lib/cn'
import { Glyph, type GlyphKind } from '../glyph'

// The landing's column: 1,280px with 32px sides, 20px under 900px (the
// design's `.wrap`).
export const WRAP = 'relative mx-auto w-full max-w-[1280px] px-5 min-[900px]:px-8'

// A section's room above and below: 136px, 64px on a phone with a rule
// between sections (pairsight-handoff Phone).
export const SECTION =
	'relative py-[136px] max-[599px]:border-border max-[599px]:border-t max-[599px]:py-16'

// The display face as the landing sets it: tight, semibold, just under one
// line high.
export const DISPLAY = 'font-display leading-[0.98] font-semibold tracking-[-0.03em]'

// The small mono caps line over a heading, with its tile: ice for what
// holds, vermilion for the caveats.
export function Eyebrow({
	glyph,
	tone = 'ice',
	children
}: {
	glyph?: Extract<GlyphKind, 'same' | 'different'>
	tone?: 'ice' | 'brand'
	children: React.ReactNode
}) {
	return (
		<p
			className={cn(
				'flex items-center gap-2.5 font-mono text-[0.8125rem] leading-[18px] tracking-[0.06em] uppercase',
				tone === 'ice' ? 'text-ice-text' : 'text-brand-text'
			)}
		>
			{glyph != null && <LandingGlyph kind={glyph} />}
			{children}
		</p>
	)
}

// The equals and not-equals tile in the landing's tints.
export function LandingGlyph({
	kind,
	className
}: {
	kind: 'same' | 'different' | 'missing'
	className?: string
}) {
	return (
		<Glyph
			kind={kind}
			className={cn(
				'size-[26px] text-[0.8125rem]',
				kind === 'same' && 'bg-ice-text/18 text-ice-text',
				kind === 'different' && 'bg-brand-text/18 text-brand-text',
				className
			)}
		/>
	)
}

// A section's headline: the claim, then its second half in grey.
export function SectionTitle({
	id,
	lead,
	accent,
	className
}: {
	id: string
	lead: string
	accent: string
	className?: string
}) {
	return (
		<h2
			id={id}
			className={cn(
				'mt-6 text-[clamp(44px,5.4vw,80px)] max-[599px]:mt-[18px] max-[599px]:text-4xl',
				DISPLAY,
				// A phone sets section headings a little looser.
				'max-[599px]:leading-[1.05] max-[599px]:tracking-[-0.025em]',
				className
			)}
		>
			{lead} <br />
			<span className="text-text-muted">{accent}</span>
		</h2>
	)
}
