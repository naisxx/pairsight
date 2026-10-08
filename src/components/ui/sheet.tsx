'use client'

import { Dialog as DialogPrimitive } from 'radix-ui'
import { CloseIcon } from './icons'

// A sheet that slides up from the bottom of a small screen: the phone's way
// to look at one thing without leaving the list under it. It's a dialog
// underneath (Radix traps focus, Escape and the scrim close it, focus goes
// back to what opened it). Header actions sit beside the close button.
export function Sheet({
	open,
	onOpenChange,
	title,
	closeLabel,
	actions,
	children
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	// Named for screen readers; the content carries its own visible heading.
	title: string
	closeLabel: string
	actions?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black/50" />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					className="border-border bg-bg data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out shadow-elevated fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-xl border border-b-0 focus:outline-none"
				>
					{/* The grab handle: says "this slides", the scrim and Close dismiss it. */}
					<span aria-hidden className="bg-border-input mx-auto mt-2.5 h-1 w-10 rounded-full" />
					<div className="flex items-center justify-between gap-2 px-4 pt-2 pb-2">
						<DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
						<div className="flex items-center gap-1">{actions}</div>
						<DialogPrimitive.Close
							aria-label={closeLabel}
							className="text-text-muted hover:bg-surface-hover hover:text-text flex size-11 items-center justify-center rounded-md transition-colors duration-150"
						>
							<CloseIcon />
						</DialogPrimitive.Close>
					</div>
					<div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
						{children}
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
