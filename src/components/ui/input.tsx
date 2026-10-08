import { cn } from '@/lib/cn'

// Shared by Input, Textarea and the native Select so every field has the
// same edge, fill and invalid state. Focus is a 2px coral edge (in place of
// the global ring, so a field never shows two).
export const fieldClassName =
	'border-border-input bg-surface text-text w-full rounded-md border px-3 text-sm placeholder:text-text-muted transition-[border-color] duration-150 ease-out focus:border-action focus:shadow-[0_0_0_1px_var(--action)] focus-visible:outline-none aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
	return <input className={cn(fieldClassName, 'h-10 pointer-coarse:h-11', className)} {...props} />
}
