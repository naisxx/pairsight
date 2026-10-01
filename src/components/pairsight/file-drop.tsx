'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CsvFileIcon, SpinnerIcon, UploadIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { IconTile } from '@/components/ui/icon-tile'

// A dropzone that is also a plain file input (keyboard and screen-reader
// users get the native control). Accepts one CSV. Styled as the empty-state
// block (DESIGN.md §5) sitting inside the dashed zone: the zone is the preview.
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
	const t = useTranslations('FileDrop')
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
				'border-border-input bg-surface-muted/60 hover:bg-surface-hover focus-within:outline-ring flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 border-dashed p-6 text-left transition-colors focus-within:outline-2 sm:p-8',
				isOver && 'border-action bg-selected',
				isBusy && 'pointer-events-none opacity-70'
			)}
		>
			<IconTile icon={isBusy ? SpinnerIcon : CsvFileIcon} size="lg" className="mb-1" />
			<span className="text-text type-heading">{isBusy ? busyLabel : label}</span>
			<span className="text-text-muted type-body max-w-[52ch]">{hint}</span>
			{!isBusy && (
				// Decorative: the whole zone is the file input's label.
				<span
					aria-hidden
					className="bg-action text-action-ink type-label mt-2 inline-flex h-9 items-center gap-2 rounded px-4"
				>
					<UploadIcon />
					{t('choose')}
				</span>
			)}
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
