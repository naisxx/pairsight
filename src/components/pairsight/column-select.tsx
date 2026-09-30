'use client'

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/cn'

// A labeled picker over a CSV's column headers (record reference, a vendor's
// record A/B columns).
export function ColumnSelect({
	label,
	value,
	headers,
	onChange,
	className
}: {
	label: string
	value: string
	headers: string[]
	onChange: (header: string) => void
	className?: string
}) {
	const id = useId()
	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{headers.map((header) => (
						<SelectItem key={header} value={header}>
							{header}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
