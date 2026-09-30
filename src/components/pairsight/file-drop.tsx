'use client'

import { useId, useState } from 'react'
import { SpinnerIcon, UploadIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// A dropzone that is also a plain file input (keyboard and screen-reader
// users get the native control). Accepts one CSV.
export function FileDrop({
	label,
	hint,
	busyLabel,
	isBusy,
	onFile
}: {
	label: string
	hint: string
	busyLabel: string
	isBusy: boolean
	onFile: (file: File) => void
}) {
	const id = useId()
	const [isOver, setIsOver] = useState(false)
	return (
		<label
			htmlFor={id}
			onDragOver={(event) => {
				event.preventDefault()
				setIsOver(true)
			}}
			onDragLeave={() => setIsOver(false)}
			onDrop={(event) => {
				event.preventDefault()
				setIsOver(false)
				const file = event.dataTransfer.files[0]
				if (file != null) onFile(file)
			}}
			className={cn(
				'border-border-input bg-surface hover:bg-surface-hover focus-within:outline-ring flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2',
				isOver && 'border-action bg-selected',
				isBusy && 'pointer-events-none opacity-70'
			)}
		>
			{isBusy ? (
				<SpinnerIcon size={22} className="text-text-muted" />
			) : (
				<UploadIcon size={22} className="text-text-muted" />
			)}
			<span className="text-text text-sm font-medium">{isBusy ? busyLabel : label}</span>
			<span className="text-text-muted text-xs">{hint}</span>
			<input
				id={id}
				type="file"
				accept=".csv,text/csv"
				className="sr-only"
				disabled={isBusy}
				onChange={(event) => {
					const file = event.target.files?.[0]
					if (file != null) onFile(file)
					event.target.value = ''
				}}
			/>
		</label>
	)
}
