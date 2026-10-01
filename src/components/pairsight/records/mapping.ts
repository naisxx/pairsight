import type { FieldRole } from '@/server/pairsight/fields'

// The Records mapping as the screen shows it: each PairSight field and the
// one column that holds it. The server stores the same thing the other way
// round (a record reference column plus a role per column), so this converts
// both ways. A column holds at most one field.

export type MappableRole = Exclude<FieldRole, 'other'>
export type FieldKey = 'reference' | MappableRole
export type Mapping = ReadonlyMap<FieldKey, string>

function isMappable(role: FieldRole): role is MappableRole {
	return role !== 'other'
}

export function fieldKeys(roles: readonly FieldRole[]): FieldKey[] {
	return ['reference', ...roles.filter(isMappable)]
}

// The server's suggestions: its reference column, then the first column
// suggested for each role.
export function suggestedMapping({
	headers,
	suggestedReference,
	suggestedRoles
}: {
	headers: string[]
	suggestedReference: string | undefined
	suggestedRoles: Record<string, FieldRole>
}): Mapping {
	const mapping = new Map<FieldKey, string>()
	if (suggestedReference != null) mapping.set('reference', suggestedReference)
	for (const header of headers) {
		const role = suggestedRoles[header]
		if (role == null || !isMappable(role) || header === suggestedReference || mapping.has(role)) {
			continue
		}
		mapping.set(role, header)
	}
	return mapping
}

// A saved dataset's mapping, for showing it back.
export function savedMapping({
	referenceColumn,
	columnRoles
}: {
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
}): Mapping {
	const mapping = new Map<FieldKey, string>([['reference', referenceColumn]])
	for (const [header, role] of Object.entries(columnRoles)) {
		if (isMappable(role) && !mapping.has(role)) mapping.set(role, header)
	}
	return mapping
}

// Puts `column` on `key` (or clears it with null). A column already on another
// field moves off it: one column, one field.
export function assignColumn(mapping: Mapping, key: FieldKey, column: string | null): Mapping {
	const next = new Map([...mapping].filter(([field, held]) => field !== key && held !== column))
	if (column != null) next.set(key, column)
	return next
}

export function fieldFor(mapping: Mapping, header: string): FieldKey | null {
	return [...mapping].find(([, column]) => column === header)?.[0] ?? null
}

export function sameMapping(a: Mapping, b: Mapping): boolean {
	return a.size === b.size && [...a].every(([key, column]) => b.get(key) === column)
}

// What the server saves: every column but the reference gets a role, "other"
// when no field is mapped to it.
export function toColumnRoles(mapping: Mapping, headers: string[]): Record<string, FieldRole> {
	const reference = mapping.get('reference')
	return Object.fromEntries(
		headers
			.filter((header) => header !== reference)
			.map((header) => {
				const field = fieldFor(mapping, header)
				return [header, field == null || field === 'reference' ? 'other' : field]
			})
	)
}
