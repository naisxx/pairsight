import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ShowIcon } from '@/components/ui/icons'

const ICON_SIZE = 15

// The strip over every sandbox page: what this is (a prepared evaluation on
// fictional data, read-only), where its judgments came from, and the way to
// run your own.
export async function SandboxBanner({
	recording,
	isSignedIn
}: {
	recording: { model: string; recordedAt: Date }
	isSignedIn: boolean
}) {
	const [t, format] = await Promise.all([getTranslations('Sandbox'), getFormatter()])
	return (
		<div
			role="note"
			aria-label={t('bannerLabel')}
			className="drop border-border bg-surface-muted text-text flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 md:px-6"
		>
			<ShowIcon size={ICON_SIZE} className="text-accent-ink shrink-0" />
			{/* On phones the short form, on one line; the full sentence wraps to five there. */}
			<p className="type-ui min-w-0 flex-1 sm:hidden">
				{t.rich('bannerShort', { b: (chunks) => <span className="font-semibold">{chunks}</span> })}
			</p>
			<p className="type-ui hidden min-w-0 flex-1 sm:block">
				{t.rich('banner', {
					model: recording.model,
					date: format.dateTime(recording.recordedAt, { dateStyle: 'medium' }),
					b: (chunks) => <span className="font-semibold">{chunks}</span>,
					n: (chunks) => <span className="font-mono">{chunks}</span>
				})}
			</p>
			<Button size="sm" asChild>
				<Link href={isSignedIn ? '/evaluations' : '/sign-up'}>
					{isSignedIn ? (
						t('yourEvaluations')
					) : (
						<>
							{/* One line on a phone, so the page starts sooner. */}
							<span className="sm:hidden">{t('signUpShort')}</span>
							<span className="hidden sm:inline">{t('signUp')}</span>
						</>
					)}
				</Link>
			</Button>
		</div>
	)
}
