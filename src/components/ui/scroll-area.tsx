import { cn } from '@/lib/cn'

// A list that scrolls inside its card instead of stretching it: anything
// that grows with the data (rules, evaluations, problems found in a file).
// Its edges fade where there's more to scroll. It can be focused and is
// named (a group inside its card), so the keyboard and screen readers reach
// what's below the fold.
//
// `fillRow`: for a card beside others in a row (a `@5xl` grid). There it
// fills whatever height the row's other cards set and never sets the row's
// height itself; stacked on a narrow screen, it stops at a fixed height. The
// card must be a full-height flex column. Otherwise it stops at the max
// height `className` gives it.
const SCROLL = 'scroll-fade-y overflow-y-auto overscroll-contain'

export function ScrollArea({
	label,
	fillRow = false,
	className,
	children
}: {
	label: string
	fillRow?: boolean
	className?: string
	children: React.ReactNode
}) {
	const area = (classes: string) => (
		<div
			// A group, not a region: it sits inside a card that is already the
			// region, under the same name.
			role="group"
			aria-label={label}
			// Focusable only so the keyboard can scroll it.
			tabIndex={0}
			className={cn(SCROLL, classes, className)}
		>
			{children}
		</div>
	)
	if (!fillRow) return area('')
	return (
		<div className="relative min-h-0 flex-1 @5xl:min-h-56">
			{area('max-h-80 @5xl:absolute @5xl:inset-0 @5xl:max-h-none')}
		</div>
	)
}
