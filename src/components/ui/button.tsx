import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// Focus comes from the global :focus-visible ring (globals.css); a button
// never draws its own. Primary is vermilion with near-black text, a touch
// brighter on hover, and the dimmed --action-disabled; secondary is the
// design's outline button (a 1px edge, no fill). Exported for a non-button
// that must look like one (the file dropzone's decorative "Browse files").
// `data-variant` lets a container restyle its buttons (the dock, globals.css).
export const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold select-none transition-[background-color,box-shadow,color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:active:scale-100',
	{
		variants: {
			variant: {
				primary:
					'bg-action text-action-ink hover:bg-action-active active:bg-action-active disabled:bg-action-disabled disabled:text-text-muted',
				secondary:
					'text-text shadow-[inset_0_0_0_1px_var(--border-strong)] hover:shadow-[inset_0_0_0_1px_var(--text)] disabled:text-text-muted',
				ghost: 'bg-ghost text-text hover:bg-surface-hover disabled:text-text-muted',
				// Toolbar and icon actions that shouldn't compete with the content.
				quiet: 'text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50',
				danger:
					'bg-surface text-danger shadow-[inset_0_0_0_1px_var(--danger)] hover:bg-danger-subtle disabled:opacity-50'
			},
			size: {
				sm: 'type-ui h-9 px-3 font-semibold pointer-coarse:h-11 pointer-coarse:min-w-11',
				default: 'h-11 px-[18px] text-[0.9375rem]',
				lg: 'h-[54px] rounded-[14px] px-6 text-base',
				icon: 'size-9 pointer-coarse:size-11',
				'icon-sm': 'size-7 pointer-coarse:size-11'
			}
		},
		defaultVariants: {
			variant: 'primary',
			size: 'default'
		}
	}
)

// The end cap of a two-part button: the icon in its own square, behind a
// seam, flush with the button's right edge (the large one for the landing
// page's 54px buttons).
const CAP_CLASS_NAME =
	'border-action-ink/22 bg-action-ink/12 flex items-center justify-center self-stretch border-l'
const CAP_SIZE_CLASS_NAME = { default: '-mr-[18px] w-11', lg: '-mr-6 w-[54px]' }

type ButtonProps = React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		// Renders as its child (e.g. next-intl's <Link>) instead of a <button>
		// — keeps the same classes without nesting an <a> inside a <button>.
		// See https://www.radix-ui.com/primitives/docs/utilities/slot.
		asChild?: boolean
		// An icon for the two-part button's end cap ("Open results →"). For
		// the primary button at the default or large size.
		cap?: React.ReactNode
	}

// No forwardRef — React 19 accepts `ref` as a normal prop on function
// components now, and React.ComponentProps<'button'> already includes it.
export function Button({
	className,
	variant,
	size,
	asChild,
	type,
	cap,
	children,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : 'button'
	return (
		<Comp
			// A plain button never submits a form by accident; pass type="submit" to.
			type={asChild ? type : (type ?? 'button')}
			data-variant={variant ?? 'primary'}
			className={cn(
				buttonVariants({ variant, size }),
				cap != null &&
					(size === 'lg' ? 'gap-[22px] overflow-hidden' : 'gap-[18px] overflow-hidden'),
				className
			)}
			{...props}
		>
			<Slottable>{children}</Slottable>
			{cap != null && (
				<span className={cn(CAP_CLASS_NAME, CAP_SIZE_CLASS_NAME[size === 'lg' ? 'lg' : 'default'])}>
					{cap}
				</span>
			)}
		</Comp>
	)
}
