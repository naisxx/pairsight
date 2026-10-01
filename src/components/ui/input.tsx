import { cn } from '@/lib/cn'

// Shared by Input, Textarea and the native Select so every field has the
// same edge, fill and invalid state. Focus is the global ring.
export const fieldClassName =
	'border-border-input bg-surface text-text w-full rounded-sm border px-3 text-sm placeholder:text-text-muted transition-[border-color] duration-150 ease-out aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
	return <input className={cn(fieldClassName, 'h-9', className)} {...props} />
}
