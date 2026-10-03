'use client'

import { useToast } from '@/lib/toast'
import { SpinnerIcon } from '@/components/ui/icons'
import {
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport
} from '@/components/ui/toast'

const SPINNER_SIZE = 14

// Mounted once in the root layout. Call toast() from src/lib/toast.ts
// anywhere in the app to show one — nothing else to wire up per call site.
export function Toaster() {
	const { toasts, dismiss } = useToast()

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, variant, action, isLoading }) => (
				<Toast
					key={id}
					variant={variant}
					// A loading toast stays until its work closes it (dismissToast).
					duration={isLoading === true ? Infinity : undefined}
					onOpenChange={(open) => !open && dismiss(id)}
				>
					<div className="grid gap-0.5">
						{title && (
							<ToastTitle className="flex items-center gap-2">
								{isLoading === true && <SpinnerIcon size={SPINNER_SIZE} className="shrink-0" />}
								{title}
							</ToastTitle>
						)}
						{description && <ToastDescription>{description}</ToastDescription>}
						{action != null && (
							<div>
								<ToastAction altText={action.label} onClick={action.onClick}>
									{action.label}
								</ToastAction>
							</div>
						)}
					</div>
					<ToastClose />
				</Toast>
			))}
			<ToastViewport />
		</ToastProvider>
	)
}
