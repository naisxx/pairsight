import { cn } from '@/lib/cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden
			className={cn('bg-surface-muted animate-pulse rounded-sm', className)}
			{...props}
		/>
	)
}

export { Skeleton }
