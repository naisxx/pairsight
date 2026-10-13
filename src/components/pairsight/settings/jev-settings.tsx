import { getFormatter, getTranslations } from 'next-intl/server'
import { AlertIcon, LockIcon } from '@/components/ui/icons'
import type { JevConnectionStatus } from '@/server/ai/jev-credentials'
import { Glyph } from '../glyph'
import { JevKeyForm } from './jev-key-form'

const ICON_SIZE = 15

// The Jev connection, as Settings shows it: where runs get their key from
// (one saved here, the server's own, or none yet), never the key itself, and
// for an admin the way to set or remove one.
export async function JevSettings({
	status,
	canManage,
	defaultBaseUrl
}: {
	status: JevConnectionStatus
	canManage: boolean
	// Where Jev is unless an admin says otherwise: TypeSafe's address.
	defaultBaseUrl: string
}) {
	const [t, format] = await Promise.all([getTranslations('Settings'), getFormatter()])
	const { saved } = status
	const isUsingSaved = status.source === 'saved' && saved != null

	return (
		<section
			aria-labelledby="jev-title"
			className="bg-surface border-border mt-10 max-w-[720px] rounded-lg border p-6 md:p-7"
		>
			<h2 id="jev-title" className="font-display text-2xl leading-tight font-semibold">
				{t('jevTitle')}
			</h2>
			<p className="text-text-body mt-2">{t('jevIntro')}</p>

			<p
				role="status"
				className="border-border mt-5 flex items-start gap-3 border-t pt-5 text-base"
			>
				<Glyph
					kind={status.source === 'none' ? 'missing' : 'same'}
					className="size-6 text-[0.8125rem]"
				/>
				<span>
					{isUsingSaved
						? t.rich('statusSaved', {
								last4: saved.keyLast4,
								date: format.dateTime(saved.checkedAt, { dateStyle: 'medium' }),
								k: (chunks) => <span className="font-mono font-semibold">{chunks}</span>
							})
						: status.source === 'server'
							? t('statusServer')
							: t('statusNone')}
					{isUsingSaved && saved.baseUrl !== defaultBaseUrl && (
						<span className="text-text-muted block text-sm">
							{t('statusAddress')} <span className="font-mono">{saved.baseUrl}</span>
						</span>
					)}
				</span>
			</p>
			{saved?.isUnreadable === true && (
				<p className="bg-warning-subtle text-warning type-ui mt-4 flex gap-2 rounded-sm p-3">
					<AlertIcon size={ICON_SIZE} className="mt-px shrink-0" />
					{t('statusUnreadable')}
				</p>
			)}

			{canManage && status.canSave && (
				<JevKeyForm baseUrl={saved?.baseUrl ?? defaultBaseUrl} hasSaved={saved != null} />
			)}
			<p className="text-text-muted mt-5 flex items-start gap-2 text-sm">
				<LockIcon size={ICON_SIZE} className="mt-0.5 shrink-0" />
				{!canManage ? t('adminOnly') : status.canSave ? t('storedEncrypted') : t('cannotStore')}
			</p>
		</section>
	)
}
