'use client'

import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/cn'
import { CloseIcon } from './icons'

const WIDTHS = {
	sm: 'max-w-[420px]',
	md: 'max-w-[520px]',
	lg: 'max-w-[640px]',
	xl: 'max-w-[760px]'
}

// A controlled modal: title, optional description, a scrolling body and a
// footer for its actions. Radix traps focus and returns it on close.
export function Dialog({
	open,
	onOpenChange,
	title,
	description,
	closeLabel,
	width = 'md',
	footer,
	children
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: React.ReactNode
	closeLabel: string
	width?: keyof typeof WIDTHS
	footer?: React.ReactNode
	children?: React.ReactNode
}) {
	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black/40" />
				<DialogPrimitive.Content
					className={cn(
						'border-border bg-surface-elevated text-text shadow-elevated data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border focus:outline-none',
						WIDTHS[width]
					)}
				>
					<div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
						<div>
							<DialogPrimitive.Title className="type-heading">{title}</DialogPrimitive.Title>
							{/* Radix wants a description; without one it repeats the title for screen readers only. */}
							<DialogPrimitive.Description
								className={description != null ? 'text-text-muted mt-1 text-sm' : 'sr-only'}
							>
								{description ?? title}
							</DialogPrimitive.Description>
						</div>
						<DialogPrimitive.Close
							aria-label={closeLabel}
							className="text-text-muted hover:bg-surface-hover hover:text-text -mr-2 rounded-sm p-1.5 transition-colors duration-150 pointer-coarse:flex pointer-coarse:size-11 pointer-coarse:items-center pointer-coarse:justify-center"
						>
							<CloseIcon />
						</DialogPrimitive.Close>
					</div>
					{children != null && <div className="overflow-y-auto px-6 py-3">{children}</div>}
					{footer != null && (
						<div className="border-border flex justify-end gap-2 border-t px-6 py-4">{footer}</div>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
