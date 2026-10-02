'use client'

import { useToast } from '@/lib/toast'
import {
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport
} from '@/components/ui/toast'

// Mounted once in the root layout. Call toast() from src/lib/toast.ts
// anywhere in the app to show one — nothing else to wire up per call site.
export function Toaster() {
	const { toasts, dismiss } = useToast()

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, variant, action }) => (
				<Toast key={id} variant={variant} onOpenChange={(open) => !open && dismiss(id)}>
					<div className="grid gap-0.5">
						{title && <ToastTitle>{title}</ToastTitle>}
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
