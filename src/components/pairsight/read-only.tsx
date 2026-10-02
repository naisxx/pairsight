'use client'

import { useTranslations } from 'next-intl'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { useIsReadOnly } from './evaluation-context'

// What a sandbox visitor would need an account for, named on the tooltip.
export type ReadOnlyAction =
	'upload' | 'vendor' | 'rules' | 'run' | 'threshold' | 'retry' | 'turnOff'

// One action, in the read-only sandbox: shown, but inert, with a "Sign up to
// …" tip on hover and focus. Outside the sandbox it renders the child as is.
// The server actions refuse the sandbox anyway; this keeps the UI honest.
export function ReadOnlyGate({
	action,
	children
}: {
	action: ReadOnlyAction
	children: React.ReactNode
}) {
	const isReadOnly = useIsReadOnly()
	const t = useTranslations('Sandbox')
	if (!isReadOnly) return children
	const label = t('readOnly', { action: t(`actions.${action}`) })
	return (
		<Tip content={label}>
			<span
				tabIndex={0}
				aria-label={label}
				aria-disabled
				className="inline-flex cursor-not-allowed rounded-sm"
			>
				<span inert className="pointer-events-none inline-flex opacity-50">
					{children}
				</span>
			</span>
		</Tip>
	)
}

// A whole region of form controls (identity, rules, a vendor's settings):
// disabled in the sandbox, so it reads as it is without being editable.
// `className` lays out its children, which are no longer the parent's.
export function ReadOnlyFieldset({
	className,
	children
}: {
	className?: string
	children: React.ReactNode
}) {
	const isReadOnly = useIsReadOnly()
	return (
		<fieldset disabled={isReadOnly} className={cn('min-w-0', className)}>
			{children}
		</fieldset>
	)
}
