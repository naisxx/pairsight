import { formatNoteKind } from '@/lib/pairsight/format-note'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { isPairsightMatch } from '@/lib/pairsight/decisions'
import type { LandingDemo, LandingField } from '@/server/pairsight/landing-demo'
import { Eyebrow, LandingGlyph, SECTION, SectionTitle, WRAP } from './parts'

// How many of the pair's fields a phone shows.
const PHONE_FIELDS = 5
const ROW = 'grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center gap-2'

function glyphOf(field: LandingField): 'same' | 'different' | 'missing' {
	return field.comparison === 'same'
		? 'same'
		: field.comparison === 'different'
			? 'different'
			: 'missing'
}

// Where they differ (pairsight-handoff Phone): on a phone, in place of the
// walkthrough's pinned scenes, the demo's pair opened field by field and
// what Jev and each vendor said about it.
export async function PhoneInspector({ demo }: { demo: LandingDemo }) {
	const [t, tRoles, tPair] = await Promise.all([
		getTranslations('HomePage'),
		getTranslations('Roles'),
		getTranslations('Pair')
	])
	const { story } = demo
	const value = (text: string) =>
		text.trim() === '' ? (
			<span className="text-text-muted font-sans italic">{tPair('missing')}</span>
		) : (
			text
		)

	return (
		<section aria-labelledby="differ-title" className={cn(SECTION, 'min-[600px]:hidden')}>
			<div className={WRAP}>
				<Eyebrow glyph="different" tone="brand">
					{t('differEyebrow')}
				</Eyebrow>
				<SectionTitle id="differ-title" lead={t('differTitle')} accent={t('differTitleAccent')} />
				<div
					role="group"
					aria-label={t('differLabel')}
					className="bg-surface border-border mt-6 overflow-hidden rounded-[20px] border px-4 pt-2"
				>
					<p
						className={cn(
							ROW,
							'text-text-muted py-2.5 font-mono text-[0.8125rem] tracking-[0.06em] uppercase'
						)}
					>
						<span>{story.refs[0]}</span>
						<span />
						<span className="text-right">{story.refs[1]}</span>
					</p>
					{story.fields.slice(0, PHONE_FIELDS).map((field) => (
						<div
							key={field.role}
							className={cn(ROW, 'border-border border-t py-2.5 font-mono text-[0.8125rem]')}
						>
							<span className="min-w-0">
								<small className="text-text-muted block font-sans text-xs">
									{tRoles(field.role)}
								</small>
								{value(field.a)}
							</span>
							<LandingGlyph kind={glyphOf(field)} className="size-7" />
							<span className="min-w-0 text-right">
								<small className="text-text-muted block font-sans text-xs">
									{field.isFormatOnly
										? tPair('formatNote', { kind: formatNoteKind(field.a, field.b) })
										: ' '}
								</small>
								{value(field.b)}
							</span>
						</div>
					))}
					<div className="bg-inverse text-on-inverse -mx-4 mt-2 p-4">
						<span className="font-mono text-4xl font-semibold tracking-[-0.03em]">
							{story.score.toFixed(2)}
						</span>
						<p className="mt-1">
							{t.rich('openJevSays', {
								same: String(isPairsightMatch({ score: story.score, threshold: demo.threshold })),
								b: (chunks) => <strong>{chunks}</strong>
							})}{' '}
							{story.said.map((vendor) => (
								<span key={vendor.name}>
									{t.rich('differVendorSays', {
										vendor: vendor.name,
										same: String(vendor.isSame),
										b: (chunks) => (
											<strong className={vendor.isSame ? undefined : 'text-inverse-brand'}>
												{chunks}
											</strong>
										)
									})}{' '}
								</span>
							))}
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
