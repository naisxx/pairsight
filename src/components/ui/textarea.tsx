import { cn } from '@/lib/cn'
import { fieldClassName } from './input'

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			className={cn(fieldClassName, 'min-h-20 resize-y py-2 leading-relaxed', className)}
			{...props}
		/>
	)
}
