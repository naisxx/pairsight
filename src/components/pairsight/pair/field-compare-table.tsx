import { useTranslations } from 'next-intl'
import { EqualIcon, MissingIcon, NotEqualIcon } from '@/components/ui/icons'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/cn'
import type { FieldComparison } from '@/server/pairsight/compare'

const COMPARISON_ICON = {
	same: EqualIcon,
	different: NotEqualIcon,
	oneMissing: MissingIcon,
	bothMissing: MissingIcon
} as const

// The two records side by side, one row per mapped field. Differences get a
// tint AND an icon and label — tint is never the only signal.
export function FieldCompareTable({
	fields,
	referenceA,
	referenceB
}: {
	fields: FieldComparison[]
	referenceA: string
	referenceB: string
}) {
	const t = useTranslations('Pair')
	const tRoles = useTranslations('Roles')
	return (
		<div className="border-border bg-surface overflow-x-auto rounded-lg border">
			<Table>
				<TableHeader className="bg-surface-muted">
					<TableRow>
						<TableHead className="w-40">{t('field')}</TableHead>
						<TableHead>
							{t('recordA')}{' '}
							<span className="text-text-muted font-mono font-normal">{referenceA}</span>
						</TableHead>
						<TableHead>
							{t('recordB')}{' '}
							<span className="text-text-muted font-mono font-normal">{referenceB}</span>
						</TableHead>
						<TableHead className="w-32">{t('comparison')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{fields.map((field) => {
						const Icon = COMPARISON_ICON[field.comparison]
						const isDifferent =
							field.comparison === 'different' || field.comparison === 'oneMissing'
						return (
							<TableRow key={field.role}>
								<TableCell className="text-text-muted text-sm">{tRoles(field.role)}</TableCell>
								{[field.a, field.b].map((value, index) => (
									<TableCell
										key={index}
										className={cn(
											'text-text text-sm break-words whitespace-normal',
											isDifferent && 'bg-accent/40'
										)}
									>
										{value === '' ? <span className="text-text-muted italic">—</span> : value}
									</TableCell>
								))}
								<TableCell>
									<span
										className={cn(
											'inline-flex items-center gap-1.5 text-xs',
											field.comparison === 'same' ? 'text-text-muted' : 'text-text font-medium'
										)}
									>
										<Icon size={14} />
										{t(field.comparison)}
									</span>
								</TableCell>
							</TableRow>
						)
					})}
				</TableBody>
			</Table>
		</div>
	)
}

// Unmapped columns, kept out of the comparison but available for inspection.
export function AllColumns({
	headers,
	valuesA,
	valuesB
}: {
	headers: string[]
	valuesA: Record<string, string>
	valuesB: Record<string, string>
}) {
	const t = useTranslations('Pair')
	if (headers.length === 0) return null
	return (
		<details className="border-border bg-surface rounded-lg border">
			<summary className="text-text cursor-pointer px-4 py-3 text-sm font-medium">
				{t('allColumns')}
			</summary>
			<dl className="border-border grid grid-cols-[minmax(0,10rem)_1fr_1fr] gap-x-4 gap-y-2 border-t px-4 py-3 text-sm">
				{headers.map((header) => (
					<div key={header} className="contents">
						<dt className="text-text-muted truncate font-mono text-xs">{header}</dt>
						<dd className="text-text break-words">{valuesA[header] || '—'}</dd>
						<dd className="text-text break-words">{valuesB[header] || '—'}</dd>
					</div>
				))}
			</dl>
		</details>
	)
}
