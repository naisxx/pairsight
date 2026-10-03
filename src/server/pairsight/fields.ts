import { IDENTITY_ROLES, type IdentityRole } from '@/lib/pairsight/entity-types'

// The roles a source column can be mapped to: every type's identity fields
// (src/lib/pairsight/entity-types.ts), plus `other` — kept for inspection but
// never sent to Jev or used for blocking.
export const FIELD_ROLES = [...IDENTITY_ROLES, 'other'] as const

export type FieldRole = (typeof FIELD_ROLES)[number]

export type { IdentityRole }

export function isIdentityRole(role: FieldRole): role is IdentityRole {
	return role !== 'other'
}

// A stored row (header -> original value) seen through its column roles.
// `other` columns stay out; a role is mapped to at most one column.
export function mapRecordFields({
	values,
	columnRoles
}: {
	values: Record<string, string>
	columnRoles: Record<string, FieldRole>
}): Partial<Record<IdentityRole, string>> {
	const fields: Partial<Record<IdentityRole, string>> = {}
	for (const [header, role] of Object.entries(columnRoles)) {
		const value = values[header]
		if (isIdentityRole(role) && value != null && value !== '') fields[role] = value
	}
	return fields
}

// The identity fields a mapping provides.
export function mappedIdentityRoles(columnRoles: Record<string, FieldRole>): Set<IdentityRole> {
	return new Set(Object.values(columnRoles).filter(isIdentityRole))
}

// Roles mapped to more than one column — ambiguous, so the mapping is invalid.
export function duplicateRoles(columnRoles: Record<string, FieldRole>): IdentityRole[] {
	const roles = Object.values(columnRoles).filter(isIdentityRole)
	return [...new Set(roles.filter((role, index) => roles.indexOf(role) !== index))]
}
