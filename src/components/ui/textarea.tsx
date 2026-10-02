import { cn } from '@/lib/cn'
import { fieldClassName } from './input'

// Grows with what's typed (field-sizing), so nothing is cut off mid-sentence.
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			className={cn(
				fieldClassName,
				'[field-sizing:content] min-h-20 resize-y py-2 leading-relaxed',
				className
			)}
			{...props}
		/>
	)
}
