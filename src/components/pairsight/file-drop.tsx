'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { DropScene } from './empty/scenes'
import { cn } from '@/lib/cn'
import { TABULAR_ACCEPT } from '@/lib/pairsight/tabular-formats'

const ICON_SIZE = 22

// A dropzone that is also a plain file input (keyboard and screen-reader
// users get the native control). Accepts one file in a format PairSight reads.
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
				'focus-within:outline-focus flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-[background-color,border-color] duration-150 ease-out focus-within:outline-2 focus-within:outline-offset-2',
				isOver ? 'border-action bg-surface-hover' : 'border-border-input bg-surface',
				isBusy && 'pointer-events-none'
			)}
		>
			{isBusy ? (
				<span className="bg-surface-muted text-text-muted flex size-11 items-center justify-center rounded-md">
					<SpinnerIcon size={ICON_SIZE} />
				</span>
			) : (
				<DropScene />
			)}
			<span className="type-heading mt-4">{isBusy ? busyLabel : label}</span>
			<span className="type-ui text-text-muted mt-1 max-w-sm">{hint}</span>
			{!isBusy && (
				// Decorative: the whole zone is the file input's label.
				<span
					aria-hidden
					className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4')}
				>
					{t('choose')}
				</span>
			)}
			<input
				id={id}
				type="file"
				accept={TABULAR_ACCEPT}
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
