import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// Focus comes from the global :focus-visible ring (globals.css); a button
// never draws its own. Primary is the brand's three variants: coral, the
// darker --action-active on hover and press, and the dimmed --action-disabled. Exported for a non-button that must look like one
// (the file dropzone's decorative "Browse files").
export const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold select-none transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:active:scale-100',
	{
		variants: {
			variant: {
				primary:
					'bg-action text-action-ink hover:bg-action-active active:bg-action-active disabled:bg-action-disabled disabled:text-text-muted',
				secondary:
					'border border-border bg-surface-elevated text-text hover:border-border-input hover:bg-surface-hover disabled:text-text-muted',
				ghost: 'bg-ghost text-text hover:bg-surface-hover disabled:text-text-muted',
				// Toolbar and icon actions that shouldn't compete with the content.
				quiet: 'text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50',
				danger:
					'border border-danger bg-surface text-danger hover:bg-danger-subtle disabled:opacity-50'
			},
			size: {
				sm: 'type-ui h-8 px-3 font-semibold pointer-coarse:h-11 pointer-coarse:min-w-11',
				default: 'h-10 px-4 text-sm pointer-coarse:h-11',
				lg: 'h-12 px-6 text-[0.9375rem]',
				icon: 'size-8 pointer-coarse:size-11',
				'icon-sm': 'size-7 pointer-coarse:size-11'
			}
		},
		defaultVariants: {
			variant: 'primary',
			size: 'default'
		}
	}
)

type ButtonProps = React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		// Renders as its child (e.g. next-intl's <Link>) instead of a <button>
		// — keeps the same classes without nesting an <a> inside a <button>.
		// See https://www.radix-ui.com/primitives/docs/utilities/slot.
		asChild?: boolean
	}

// No forwardRef — React 19 accepts `ref` as a normal prop on function
// components now, and React.ComponentProps<'button'> already includes it.
export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
	const Comp = asChild ? Slot : 'button'
	return (
		<Comp
			// A plain button never submits a form by accident; pass type="submit" to.
			type={asChild ? type : (type ?? 'button')}
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	)
}
