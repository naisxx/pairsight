import { cn } from '@/lib/cn'

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
	return (
		<kbd
			className={cn(
				'border-border-strong text-text-body inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] border border-b-2 px-1.5 font-mono text-xs',
				className
			)}
		>
			{children}
		</kbd>
	)
}
