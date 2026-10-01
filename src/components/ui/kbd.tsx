import { cn } from '@/lib/cn'

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
	return (
		<kbd
			className={cn(
				'border-border bg-surface-muted text-text-muted inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border px-1 font-mono text-[0.6875rem]',
				className
			)}
		>
			{children}
		</kbd>
	)
}
