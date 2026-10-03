import { getTranslations } from 'next-intl/server'
import { InView } from '@/components/ui/in-view'
import { DataVisual, RulesVisual, VerdictVisual } from './step-visuals'

const STEPS = [
	{ title: 'step1Title', body: 'step1Body', Visual: DataVisual },
	{ title: 'step2Title', body: 'step2Body', Visual: RulesVisual },
	{ title: 'step3Title', body: 'step3Body', Visual: VerdictVisual }
] as const

// "How it works": three steps as cards, each with an illustration whose
// layers drift at different depths as the section scrolls by, over a soft
// brand wash with its own slower shapes behind. The cards play in once the
// section is in view (InView), numbers first, then the line on to the next.
export async function HowItWorks() {
	const t = await getTranslations('HomePage')
	return (
		<section aria-labelledby="how-title" className="how-section relative isolate overflow-hidden">
			<div aria-hidden className="how-backdrop">
				<span className="parallax depth-back how-shape how-shape--a" />
				<span className="parallax depth-3 how-shape how-shape--b" />
				<span className="parallax depth-2 how-shape how-shape--c" />
			</div>
			<InView className="mx-auto max-w-[1200px] px-5 py-20 md:px-8">
				<div className="on-view max-w-2xl">
					<p className="text-accent-ink text-xs font-semibold tracking-wide uppercase">
						{t('howEyebrow')}
					</p>
					<h2
						id="how-title"
						className="mt-2 text-2xl font-semibold tracking-[-0.015em] md:text-[28px]"
					>
						{t('howTitle')}
					</h2>
					<p className="text-text-muted mt-2 text-[15px] leading-relaxed">{t('howBody')}</p>
				</div>
				<ol className="how-steps mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
					{STEPS.map(({ title, body, Visual }, index) => (
						<li key={title} className={`stagger-${index} relative`}>
							{index < STEPS.length - 1 && (
								<span
									aria-hidden
									className="on-view-draw bg-border-input absolute top-[5.5rem] right-[-1.25rem] hidden h-px w-5 md:block"
								/>
							)}
							<div className="on-view border-border bg-surface h-full overflow-hidden rounded-lg border">
								<div className="border-border bg-surface-muted border-b">
									<Visual />
								</div>
								<div className="p-5">
									<span className="on-view-pop border-action text-accent-ink flex size-7 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold">
										{index + 1}
									</span>
									<h3 className="mt-3 text-[15px] font-semibold">{t(title)}</h3>
									<p className="text-text-muted mt-1.5 text-sm leading-relaxed">{t(body)}</p>
								</div>
							</div>
						</li>
					))}
				</ol>
			</InView>
		</section>
	)
}
