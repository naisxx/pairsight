import { useTranslations } from 'next-intl'
import { TabularFileIcon } from '../file-type'
import { Count } from '@/components/ui/count'

const ICON_SIZE = 26

// The chosen or saved file in one bar: its name, what state it's in, its
// size in rows and columns, and an action (Replace file).
export function FileDetails({
	fileName,
	meta,
	rows,
	columns,
	size,
	action
}: {
	fileName: string
	meta: string
	rows: number
	columns: number
	size?: string
	action: React.ReactNode
}) {
	const t = useTranslations('Records')
	const stats = [
		{ label: t('rows'), value: <Count value={rows} /> },
		{ label: t('columns'), value: <Count value={columns} /> },
		...(size == null ? [] : [{ label: t('size'), value: size }])
	]
	return (
		<section
			aria-label={t('fileDetails')}
			className="border-border bg-surface flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border px-4 py-3"
		>
			<div className="flex min-w-0 items-center gap-3">
				<TabularFileIcon
					fileName={fileName}
					size={ICON_SIZE}
					className="text-text-muted shrink-0"
				/>
				<div className="min-w-0">
					<p className="type-ui truncate font-mono font-medium">{fileName}</p>
					<p className="text-text-muted text-xs">{meta}</p>
				</div>
			</div>
			<dl className="type-ui flex flex-wrap gap-x-6 gap-y-1">
				{stats.map((stat) => (
					<div key={stat.label}>
						<dt className="text-text-muted text-xs">{stat.label}</dt>
						<dd className="font-mono">{stat.value}</dd>
					</div>
				))}
			</dl>
			<div className="ml-auto">{action}</div>
		</section>
	)
}
