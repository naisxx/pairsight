'use client'

import { useTranslations } from 'next-intl'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

// Asked before leaving a form with unsaved changes. "Stay" is the default
// focus and what Esc does, so the safe choice is the easy one.
export function UnsavedChangesDialog({
	isOpen,
	onStay,
	onLeave
}: {
	isOpen: boolean
	onStay: () => void
	onLeave: () => void
}) {
	const t = useTranslations('Unsaved')
	return (
		<AlertDialog open={isOpen} onOpenChange={(open) => !open && onStay()}>
			<AlertDialogContent>
				<AlertDialogTitle>{t('title')}</AlertDialogTitle>
				<AlertDialogDescription>{t('description')}</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogAction asChild>
						<Button variant="destructive" onClick={onLeave}>
							{t('leave')}
						</Button>
					</AlertDialogAction>
					<AlertDialogCancel asChild>
						<Button>{t('stay')}</Button>
					</AlertDialogCancel>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
