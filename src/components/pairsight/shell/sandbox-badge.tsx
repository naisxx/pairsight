import { getFormatter, getTranslations } from 'next-intl/server'

// The tag beside the breadcrumb on every sandbox page: this is a prepared
// evaluation on fictional data, read-only. Hovering it says when Jev's
// judgments were recorded, and by which version.
export async function SandboxBadge({
	recording
}: {
	recording: { model: string; recordedAt: Date }
}) {
	const [t, format] = await Promise.all([getTranslations('Sandbox'), getFormatter()])
	const date = format.dateTime(recording.recordedAt, { dateStyle: 'medium' })
	return (
		<p
			role="note"
			aria-label={t('bannerLabel')}
			title={t('bannerFull', { model: recording.model, date })}
			className="border-border bg-surface text-text-muted inline-flex min-h-7 items-center rounded-sm border px-2.5 font-mono text-xs whitespace-nowrap"
		>
			{t('badge')}
		</p>
	)
}
