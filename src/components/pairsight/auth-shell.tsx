import { getTranslations } from 'next-intl/server'
import { EXACT_FORMATS } from '@/i18n/formats'
import { Link } from '@/i18n/routing'
import { mosaicOf } from '@/lib/pairsight/mosaic'
import { demoPreview } from '@/server/pairsight/demo-preview'
import { Glyph } from './glyph'
import { Mosaic } from './mosaic'
import { SlimBar } from './slim-bar'

const PROMISES = [
	{ title: 'promiseRecordsTitle', body: 'promiseRecordsBody' },
	{ title: 'promiseJevTitle', body: 'promiseJevBody' },
	{ title: 'promiseRunTitle', body: 'promiseRunBody' }
] as const

// The page sign-in, sign-up and onboarding share (pairsight-handoff Auth): a
// slim bar with the mark, the way to the demo and the theme switch; the
// title, one sentence and the form; and beside them the demo's run as a
// mosaic and what happens to your records before you upload anything. A
// build without the demo (on-prem) leaves out its link and mosaic.
export async function AuthShell({
	title,
	description,
	homeHref = '/',
	children
}: {
	title: string
	description: string
	// Where the wordmark goes: the landing page signed out, evaluations in.
	homeHref?: '/' | '/evaluations'
	children: React.ReactNode
}) {
	const t = await getTranslations('Auth')
	// The products demo's best vendor, from its recorded run: the same mosaic
	// the landing page leads with, and nothing here waits on the database.
	const vendors = await demoPreview()
	const leader = vendors?.[0]
	const mosaic = leader == null ? null : mosaicOf(leader.counts)
	return (
		<div className="bg-bg text-text flex min-h-dvh flex-col text-base">
			<SlimBar homeHref={homeHref} homeLabel={t('home')} className="drop">
				{vendors != null && (
					<Link
						href="/sandbox"
						className="text-text decoration-border-strong hover:decoration-text inline-flex min-h-11 items-center underline underline-offset-[3px] transition-[text-decoration-color] duration-150"
					>
						{t('demoFirst')}
					</Link>
				)}
			</SlimBar>
			<div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-wrap items-stretch gap-x-20 gap-y-12 px-4 py-16 md:px-8">
				<main id="main" className="min-w-0 flex-[1_1_360px] md:max-w-[440px]">
					<h1 className="rise font-display text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em]">
						{title}
					</h1>
					<p className="rise stagger-1 text-text-body mt-2.5 text-base">{description}</p>
					<div className="rise stagger-2">{children}</div>
				</main>
				<aside
					aria-label={t('asideLabel')}
					className="rise stagger-3 bg-surface-muted border-border flex min-w-0 flex-[1_1_420px] flex-col gap-7 rounded-lg border p-7"
				>
					{mosaic != null && mosaic.tiles.length > 0 && (
						<div>
							<Mosaic
								mosaic={mosaic}
								label={t('mosaicLabel', { count: mosaic.tiles.length }, EXACT_FORMATS)}
							/>
							<p className="text-text-muted mt-3 text-sm">{t('mosaicCaption')}</p>
						</div>
					)}
					<div>
						<h2 className="text-text-muted type-eyebrow">{t('promisesTitle')}</h2>
						<ul>
							{PROMISES.map((promise) => (
								<li
									key={promise.title}
									className="border-border flex gap-3.5 border-b py-[18px] last:border-b-0"
								>
									<Glyph kind="same" />
									<div>
										<p className="font-semibold">{t(promise.title)}</p>
										<p className="text-text-muted mt-0.5 text-sm">{t(promise.body)}</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>
		</div>
	)
}
