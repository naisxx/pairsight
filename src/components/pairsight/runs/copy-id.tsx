'use client'

import { useTranslations } from 'next-intl'
import { CopyIcon } from '@/components/ui/icons'
import { toast } from '@/lib/toast'

// Shown: enough of an ID to tell runs apart. All of it is in the tip and on
// the clipboard, for whoever is asked for it when something goes wrong.
const SHOWN_CHARS = 8

export function CopyId({ id }: { id: string }) {
	const t = useTranslations('Runs')
	async function copy() {
		try {
			await navigator.clipboard.writeText(id)
			toast({ title: t('idCopied') })
		} catch {
			toast({ title: t('idCopyFailed'), description: id, variant: 'destructive' })
		}
	}
	return (
		<span className="inline-flex items-center gap-2">
			<span className="font-mono" title={id}>
				{id.slice(0, SHOWN_CHARS)}
			</span>
			<button
				type="button"
				onClick={() => void copy()}
				aria-label={t('copyId')}
				className="text-text-muted hover:text-text hover:bg-surface-hover hit-area inline-flex items-center gap-1 rounded-sm px-1 text-xs transition-colors duration-150"
			>
				<CopyIcon size={13} />
				{t('copy')}
			</button>
		</span>
	)
}
