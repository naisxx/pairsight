import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/reveal'
import { ProductPreview } from '../product-preview'
import { NewEvaluationButton } from './new-evaluation-button'

const STEPS = [
	{ title: 'step1Title', body: 'step1Body' },
	{ title: 'step2Title', body: 'step2Body' },
	{ title: 'step3Title', body: 'step3Body' }
] as const

// The dashboard before the first evaluation: the three steps, the way in,
// and a picture of where they lead.
export function EmptyEvaluations() {
	const t = useTranslations('Evaluations')
	return (
		<section className="border-border bg-surface mt-6 grid items-center gap-8 rounded-md border p-6 md:p-8 lg:grid-cols-12">
			<div className="lg:col-span-5">
				<h2 className="text-lg font-semibold tracking-[-0.01em]">{t('emptyTitle')}</h2>
				<p className="type-ui text-text-muted mt-1.5 leading-relaxed">{t('emptyDescription')}</p>
				<ol className="mt-5 space-y-4">
					{STEPS.map((step, index) => (
						<Reveal as="li" key={step.title} index={index} className="flex gap-3">
							<span className="border-action text-accent-ink flex size-6 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-semibold">
								{index + 1}
							</span>
							<span>
								<span className="type-ui block font-medium">{t(step.title)}</span>
								<span className="text-text-muted block text-xs">{t(step.body)}</span>
							</span>
						</Reveal>
					))}
				</ol>
				<div className="mt-6">
					<NewEvaluationButton />
				</div>
			</div>
			<Reveal index={2} className="lg:col-span-7">
				<ProductPreview />
				<p className="text-text-muted type-caption mt-2 text-center">{t('previewCaption')}</p>
			</Reveal>
		</section>
	)
}
