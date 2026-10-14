import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/reveal'
import { ProductPreview } from '../product-preview'
import { NewEvaluationButton } from './new-evaluation-button'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import type { LandingVendor } from '@/server/pairsight/landing-demo'

const STEPS = [
	{ title: 'step1Title', body: 'step1Body' },
	{ title: 'step2Title', body: 'step2Body' },
	{ title: 'step3Title', body: 'step3Body' }
] as const

// The dashboard before the first evaluation: the three steps, the way in,
// and a picture of where they lead. A build without the demo (on-prem,
// previewVendors null) has the steps and the way in only.
export function EmptyEvaluations({ previewVendors }: { previewVendors: LandingVendor[] | null }) {
	const t = useTranslations('Evaluations')
	return (
		<section className="border-border bg-surface mt-12 grid grid-cols-1 items-center gap-8 rounded-lg border p-7 @3xl:p-8 @5xl:grid-cols-12">
			<div className={previewVendors == null ? '@5xl:col-span-12' : '@5xl:col-span-5'}>
				<h2 className="type-display-sm">{t('emptyTitle')}</h2>
				<p className="text-text-muted mt-2 text-[0.9375rem] leading-relaxed">
					{t('emptyDescription')}
				</p>
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
				<div className="mt-6 flex flex-wrap gap-2">
					<NewEvaluationButton />
					{previewVendors != null && (
						<Button variant="secondary" asChild>
							<Link href="/sandbox">{t('exploreSandbox')}</Link>
						</Button>
					)}
				</div>
			</div>
			{previewVendors != null && (
				<Reveal index={2} className="@5xl:col-span-7">
					<ProductPreview vendors={previewVendors} />
					<p className="text-text-muted type-caption mt-2 text-center">{t('previewCaption')}</p>
				</Reveal>
			)}
		</section>
	)
}
