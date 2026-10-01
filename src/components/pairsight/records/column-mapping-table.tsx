'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import type { FieldRole } from '@/server/pairsight/fields'

// The preview rows with a role picker above each column. A role stays
// labeled "Suggested" until the user touches that column.
export function ColumnMappingTable({
	headers,
	sampleRows,
	referenceColumn,
	roles,
	confirmed,
	fieldRoles,
	onRoleChange
}: {
	headers: string[]
	sampleRows: string[][]
	referenceColumn: string
	roles: Record<string, FieldRole>
	confirmed: ReadonlySet<string>
	fieldRoles: readonly FieldRole[]
	onRoleChange: (header: string, role: FieldRole) => void
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const dataColumns = headers.filter((header) => header !== referenceColumn)
	return (
		<div className="border-border overflow-x-auto rounded-lg border">
			<Table>
				<TableHeader className="bg-surface-muted">
					<TableRow>
						<TableHead className="text-text type-data-sm tracking-normal normal-case">
							{referenceColumn}
						</TableHead>
						{dataColumns.map((header) => (
							<TableHead key={header} className="min-w-44 py-2 align-top">
								<div className="flex flex-col gap-1.5 font-normal tracking-normal normal-case">
									<span className="text-text type-data-sm tracking-normal normal-case">
										{header}
									</span>
									<Select
										value={roles[header] ?? 'other'}
										onValueChange={(value) =>
											onRoleChange(header, fieldRoles.find((role) => role === value) ?? 'other')
										}
									>
										<SelectTrigger
											size="sm"
											aria-label={t('roleFor', { column: header })}
											className="w-full"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{fieldRoles.map((role) => (
												<SelectItem key={role} value={role}>
													{tRoles(role)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{!confirmed.has(header) && roles[header] !== 'other' && (
										<Badge variant="secondary" className="w-fit text-[11px]">
											{t('suggested')}
										</Badge>
									)}
								</div>
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{sampleRows.map((row, rowIndex) => (
						<TableRow key={rowIndex}>
							{[referenceColumn, ...dataColumns].map((header) => (
								<TableCell key={header} className="text-text type-data-sm max-w-56 truncate">
									{row[headers.indexOf(header)] ?? ''}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
