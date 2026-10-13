import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

// The top bar of a page outside an evaluation (sign-in, sign-up, onboarding,
// the error and not-found pages): the mark, any links, and the theme switch.
export function SlimBar({
	homeHref,
	homeLabel,
	className,
	children
}: {
	homeHref: '/' | '/evaluations'
	homeLabel: string
	className?: string
	// Links before the theme switch, pushed to the right.
	children?: React.ReactNode
}) {
	return (
		<header className={cn('shrink-0 px-4 md:px-8', className)}>
			<div className="border-border mx-auto flex min-h-16 max-w-[1216px] items-center gap-4 border-b py-2.5">
				<Link
					href={homeHref}
					aria-label={homeLabel}
					className="inline-flex min-h-11 items-center rounded-sm"
				>
					<Wordmark />
				</Link>
				<div className="ml-auto flex items-center gap-4">
					{children}
					<ThemeToggle />
				</div>
			</div>
		</header>
	)
}
