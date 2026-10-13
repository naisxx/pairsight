import { cn } from '@/lib/cn'

// Shared by Input, Textarea and the native Select so every field has the
// same edge, fill and invalid state. Focus is the global ring (ice, offset),
// like every other control.
export const fieldClassName =
	'border-border-input bg-surface text-text w-full rounded-md border px-3 text-[0.9375rem] placeholder:text-text-muted transition-[border-color] duration-150 ease-out aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted in-[fieldset:disabled]:bg-bg in-[fieldset:disabled]:text-text-body'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
	return <input className={cn(fieldClassName, 'h-11', className)} {...props} />
}
