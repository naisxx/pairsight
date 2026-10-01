import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AppHeader } from '@/components/pairsight/app-header'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { redirectIfSignedIn } from '@/server/auth/session'

// Minimal landing (docs/PairSight-UX-Plan.md §4.4). The only place the
// supporting brand colors appear, and only decoratively.
export default async function HomePage() {
	await redirectIfSignedIn()
	const t = await getTranslations('HomePage')
	const steps = [t('stepUpload'), t('stepRules'), t('stepCompare')]
	return (
		<>
			<AppHeader />
			<main
				id="main"
				className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-28"
			>
				<div className="flex flex-col gap-5">
					<div
						aria-hidden
						className="from-brand-deep via-action to-brand-amber h-1 w-24 rounded-full bg-linear-to-r"
					/>
					<h1 className="text-text type-display sm:text-5xl sm:leading-[3.5rem]">{t('tagline')}</h1>
					<p className="text-text-muted max-w-2xl text-lg leading-8">{t('description')}</p>
				</div>
				<ol className="grid gap-3 sm:grid-cols-3">
					{steps.map((step, index) => (
						<li key={step} className="border-border bg-surface flex gap-3 rounded-lg border p-4">
							<span className="bg-accent text-accent-ink type-data-sm flex size-6 shrink-0 items-center justify-center rounded-full font-medium">
								{index + 1}
							</span>
							<span className="text-text type-body">{step}</span>
						</li>
					))}
				</ol>
				<div className="flex flex-wrap gap-3">
					<Button asChild size="lg">
						<Link href="/evaluations">
							{t('startEvaluation')}
							<ArrowRightIcon />
						</Link>
					</Button>
				</div>
			</main>
		</>
	)
}
