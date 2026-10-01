'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon } from '@/components/ui/icons'
import type { FieldRole } from '@/server/pairsight/fields'
import { RecordsUploader } from './records-uploader'

// Replacing the source file is a secondary action with a warning first:
// it starts a new dataset, so vendor results must be uploaded again.
export function ReplaceSource({
	evaluationId,
	roles
}: {
	evaluationId: string
	roles: readonly FieldRole[]
}) {
	const t = useTranslations('Records')
	const [isOpen, setIsOpen] = useState(false)
	if (!isOpen) {
		return (
			<Button variant="ghost" size="sm" className="mt-3 self-start" onClick={() => setIsOpen(true)}>
				{t('replace')}
			</Button>
		)
	}
	return (
		<div className="mt-5 flex flex-col gap-4">
			<p className="bg-warning-subtle text-warning type-body flex items-start gap-2 rounded px-3 py-2">
				<AlertIcon className="mt-0.5 shrink-0" />
				{t('replaceWarning')}
			</p>
			<RecordsUploader evaluationId={evaluationId} roles={roles} />
		</div>
	)
}
