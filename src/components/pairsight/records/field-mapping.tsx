'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { SparkleIcon } from '@/components/ui/icons'
import { OptionSelect } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { fieldFor, sameMapping, type FieldKey, type Mapping } from './mapping'

const SAMPLE_COUNT = 3
const SPARKLE_SIZE = 14

// Each PairSight field and the column that holds it, with a few sample
// values. Editable while choosing a file; read-only once it's saved (the
// dataset is fixed then, and replacing the file is how it changes).
export function FieldMapping({
	fields,
	headers,
	sampleRows,
	mapping,
	edit
}: {
	fields: FieldKey[]
	headers: string[]
	sampleRows: string[][]
	mapping: Mapping
	edit?: {
		suggested: Mapping
		onChange: (key: FieldKey, column: string | null) => void
		onUseAll: () => void
	}
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const tHints = useTranslations('FieldHints')
	const label = (key: FieldKey) => (key === 'reference' ? t('referenceField') : tRoles(key))
	const unmapped = headers.filter((header) => fieldFor(mapping, header) == null)
	const options = [
		{ value: '', label: t('notMapped') },
		...headers.map((header) => ({ value: header, label: header }))
	]

	return (
		<section aria-labelledby="mapping-title" className="border-border bg-surface rounded-md border">
			<header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
				<div>
					<h2 id="mapping-title" className="text-sm font-semibold">
						{edit == null ? t('savedMappingTitle') : t('mappingTitle')}
					</h2>
					<p className="text-text-muted mt-0.5 text-xs">
						{edit == null ? t('savedMappingDescription') : t('mappingDescription')}
					</p>
				</div>
				{edit != null && (
					<Button
						variant="ghost"
						size="sm"
						onClick={edit.onUseAll}
						disabled={sameMapping(mapping, edit.suggested)}
					>
						<SparkleIcon size={SPARKLE_SIZE} />
						{t('useAll')}
					</Button>
				)}
			</header>
			<div className="border-border bg-surface-muted text-text-muted hidden grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)] gap-3 border-y px-4 py-2 text-xs font-medium @3xl:grid">
				<span>{t('colField')}</span>
				<span>{t('colColumn')}</span>
				<span>{t('colSamples')}</span>
			</div>
			<ul>
				{fields.map((key) => {
					const column = mapping.get(key) ?? null
					const index = column == null ? -1 : headers.indexOf(column)
					const samples =
						index < 0 ? [] : sampleRows.slice(0, SAMPLE_COUNT).map((row) => row[index] ?? '')
					const suggestion = edit?.suggested.get(key) ?? null
					const isRequired = key === 'reference'
					const isMissing = isRequired && column == null
					const id = `map-${key}`
					return (
						<li
							key={key}
							className={cn(
								'border-border grid gap-2 border-b px-4 py-2.5 last:border-0 @3xl:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)] @3xl:items-center @3xl:gap-3',
								isMissing && 'bg-danger-subtle'
							)}
						>
							<div className="min-w-0">
								<label htmlFor={id} className="type-ui flex items-center gap-1.5 font-medium">
									{label(key)}
									<span
										className={cn(
											'type-caption font-normal',
											isRequired ? 'text-danger' : 'text-text-muted'
										)}
									>
										{isRequired ? t('required') : t('optional')}
									</span>
								</label>
								<p className="text-text-muted truncate text-xs">{tHints(key)}</p>
							</div>
							{edit == null ? (
								<p id={id} className="type-ui font-mono">
									{column ?? <span className="text-text-muted font-sans">{t('notMapped')}</span>}
								</p>
							) : (
								<OptionSelect
									id={id}
									size="sm"
									value={column ?? ''}
									onValueChange={(value) => edit.onChange(key, value === '' ? null : value)}
									options={options}
									aria-invalid={isMissing}
								/>
							)}
							<div className="flex min-w-0 items-center gap-2">
								{edit != null && column != null && column === suggestion && (
									<span className="bg-info-subtle text-info type-caption shrink-0 rounded-[5px] px-1.5 py-0.5 font-medium">
										{t('suggested')}
									</span>
								)}
								{edit != null && column == null && !isRequired && suggestion != null && (
									<button
										type="button"
										className="text-accent-ink shrink-0 text-xs font-medium hover:underline"
										onClick={() => edit.onChange(key, suggestion)}
									>
										{t('useColumn', { column: suggestion })}
									</button>
								)}
								<span className="text-text-muted truncate font-mono text-xs">
									{samples.map((value) => (value === '' ? '∅' : value)).join(' · ')}
								</span>
							</div>
						</li>
					)
				})}
			</ul>
			{unmapped.length > 0 && (
				<p className="border-border text-text-muted border-t px-4 py-2.5 text-xs">
					{t.rich('unmappedNote', {
						cols: () =>
							unmapped.map((header) => (
								<span key={header} className="text-text mr-1 font-mono">
									{header}
								</span>
							))
					})}
				</p>
			)}
		</section>
	)
}
