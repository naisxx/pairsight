'use client'

import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { CloseIcon } from '@/components/ui/icons'

export const ToastProvider = ToastPrimitives.Provider

export function ToastViewport({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Viewport>) {
	return (
		<ToastPrimitives.Viewport
			data-toast-viewport
			className={cn(
				'fixed right-0 bottom-0 z-[70] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[calc(356px+3rem)] sm:p-6',
				className
			)}
			{...props}
		/>
	)
}

const toastVariants = cva(
	'type-ui bg-surface-elevated text-text shadow-elevated data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 pointer-events-auto relative flex w-full items-start justify-between gap-3 rounded-[8px] border p-4 transition-opacity duration-200 data-[state=closed]:opacity-0',
	{
		variants: {
			variant: {
				default: 'border-border',
				destructive: 'border-danger'
			}
		},
		defaultVariants: { variant: 'default' }
	}
)

export function Toast({
	className,
	variant,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>) {
	return <ToastPrimitives.Root className={cn(toastVariants({ variant }), className)} {...props} />
}

// A toast's one follow-up. `altText` is what a screen reader hears, since
// Radix announces toasts without their buttons.
export function ToastAction({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Action>) {
	return (
		<ToastPrimitives.Action
			className={cn(
				'border-border-input hover:bg-surface-hover type-ui mt-2 inline-flex h-8 items-center rounded-sm border px-3 font-medium transition-colors duration-150',
				className
			)}
			{...props}
		/>
	)
}

export function ToastTitle({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Title>) {
	return <ToastPrimitives.Title className={cn('text-text font-medium', className)} {...props} />
}

export function ToastDescription({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Description>) {
	return <ToastPrimitives.Description className={cn('text-text-muted', className)} {...props} />
}

export function ToastClose({
	className,
	...props
}: React.ComponentProps<typeof ToastPrimitives.Close>) {
	return (
		<ToastPrimitives.Close
			aria-label="Dismiss"
			className={cn('text-text-muted hover:text-text shrink-0 rounded-sm', className)}
			{...props}
		>
			{/* Decorative: the button already carries aria-label="Dismiss". */}
			<CloseIcon />
		</ToastPrimitives.Close>
	)
}
