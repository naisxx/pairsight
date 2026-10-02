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
			className="drop border-border bg-accent text-accent-ink flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 md:px-5"
		>
			<ShowIcon size={ICON_SIZE} className="shrink-0" />
			<p className="type-ui min-w-0 flex-1">
				{t.rich('banner', {
					model: recording.model,
					date: format.dateTime(recording.recordedAt, { dateStyle: 'medium' }),
					b: (chunks) => <span className="font-semibold">{chunks}</span>,
					n: (chunks) => <span className="font-mono">{chunks}</span>
				})}
			</p>
			<Button size="sm" asChild>
				<Link href={isSignedIn ? '/evaluations' : '/sign-up'}>
					{isSignedIn ? t('yourEvaluations') : t('signUp')}
				</Link>
			</Button>
		</div>
	)
}
