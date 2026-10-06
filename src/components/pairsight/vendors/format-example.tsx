import { useTranslations } from 'next-intl'
import type { VendorFormat } from '@/server/pairsight/vendors'

const EXAMPLES: Record<VendorFormat, { head: [string, string]; rows: Array<[string, string]> }> = {
	pair: {
		head: ['first_ref', 'second_ref'],
		rows: [
			['C-1003', 'C-1004'],
			['C-1003', 'C-1006']
		]
	},
	group: {
		head: ['group_id', 'record_ref'],
		rows: [
			['G-7', 'C-1003'],
			['G-7', 'C-1004'],
			['G-7', 'C-1006']
		]
	}
}

// A two-column miniature of each format, and what it adds up to.
export function FormatExample({ format }: { format: VendorFormat }) {
	const t = useTranslations('Vendors')
	const { head, rows } = EXAMPLES[format]
	return (
		<div className="mt-3" aria-hidden>
			<table className="border-border w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border font-mono text-[11px]">
				<thead className="bg-surface-muted text-text-muted">
					<tr className="whitespace-nowrap">
						{head.map((cell) => (
							<th key={cell} className="border-border border-b px-2 py-1 text-left font-medium">
								{cell}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(([first, second]) => (
						<tr key={`${first}-${second}`}>
							<td className="border-border border-b px-2 py-1">{first}</td>
							<td className="border-border border-b px-2 py-1">{second}</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="text-text-muted type-caption mt-1.5">
				{format === 'pair' ? t('examplePair') : t('exampleGroup')}
			</p>
		</div>
	)
}
