import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import type { ResultFilters, ResultRow } from '@/server/pairsight/results'
import { CategoryBadge, ScoreBar, StatusChip } from '../result-parts'
import { toQuery } from './query'

// The current page of pairs. Incomplete rows show their status where a score
// would be — never "no match". Each row links to its pair detail.
export function PairsTable({
	base,
	filters,
	rows,
	threshold,
	vendorName,
	ruleLabels
}: {
	base: string
	filters: ResultFilters
	rows: ResultRow[]
	threshold: number
	vendorName: string
	ruleLabels: Record<string, string>
}) {
	const t = useTranslations('Results')
	return (
		<div className="border-border bg-surface overflow-x-auto rounded-lg border">
			<Table>
				<TableHeader className="bg-surface-muted sticky top-0">
					<TableRow>
						<TableHead>{t('columnCategory')}</TableHead>
						<TableHead>{t('columnRecordA')}</TableHead>
						<TableHead>{t('columnRecordB')}</TableHead>
						<TableHead>{vendorName || t('columnVendor')}</TableHead>
						<TableHead>{t('columnScore')}</TableHead>
						<TableHead>{t('columnSource')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.id} className="hover:bg-surface-hover relative h-10">
							<TableCell>
								<Link
									href={{ pathname: `${base}/pairs/${row.id}`, query: toQuery(filters) }}
									aria-label={t('openPair', { a: row.recordA.reference, b: row.recordB.reference })}
									className="focus-visible:outline-ring after:absolute after:inset-0 focus-visible:outline-2"
								>
									<CategoryBadge category={row.category} />
								</Link>
							</TableCell>
							{[row.recordA, row.recordB].map((record) => (
								<TableCell key={record.id} className="max-w-56">
									<span className="text-text type-label block truncate">{record.label}</span>
									<span className="text-text-muted type-data-sm block truncate">
										{record.reference}
									</span>
								</TableCell>
							))}
							<TableCell className="type-body">
								{row.isVendorMatch ? (
									<span className="text-text font-medium">{t('matched')}</span>
								) : (
									<span className="text-text-muted">{t('notMatched')}</span>
								)}
							</TableCell>
							<TableCell>
								{row.status === 'succeeded' && row.score != null ? (
									<span className="flex items-center gap-2">
										<ScoreBar score={row.score} threshold={threshold} />
										{row.isLowConfidence && (
											<span className="text-warning type-meta whitespace-nowrap">
												{t('lowConfidence')}
											</span>
										)}
									</span>
								) : row.status !== 'succeeded' ? (
									<StatusChip status={row.status} errorCode={row.errorCode} />
								) : null}
							</TableCell>
							<TableCell className="text-text-muted type-meta max-w-48 truncate">
								{row.ruleIds.length === 0
									? t('addedByVendor')
									: t('rules', {
											rules: row.ruleIds.map((ruleId) => ruleLabels[ruleId] ?? ruleId).join(', ')
										})}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
