'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PlusIcon } from '@/components/ui/icons'
import { createEvaluationAction } from '@/server/actions/pairsight/evaluations'
import { NameDialog } from './name-dialog'

const ICON_SIZE = 15

// Names a new evaluation; creating it opens its Records step.
export function NewEvaluationButton({
	variant = 'primary',
	size = 'default',
	takenNames = []
}: {
	variant?: 'primary' | 'secondary'
	size?: 'default' | 'sm'
	takenNames?: string[]
}) {
	const t = useTranslations('Evaluations')
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Button variant={variant} size={size} onClick={() => setIsOpen(true)}>
				<PlusIcon size={ICON_SIZE} />
				{t('newEvaluation')}
			</Button>
			<NameDialog
				open={isOpen}
				onOpenChange={setIsOpen}
				title={t('newEvaluation')}
				description={t('newDescription')}
				submitLabel={t('create')}
				pendingLabel={t('creating')}
				takenNames={takenNames}
				onSubmit={async (name) => {
					const result = await createEvaluationAction({ name })
					return result.ok ? null : result.error
				}}
			/>
		</>
	)
}
