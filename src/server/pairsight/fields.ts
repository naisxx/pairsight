// The identity roles a source column can be mapped to. `other` columns are
// kept for inspection but never sent to Jev or used for blocking.
export const FIELD_ROLES = [
	'full_name',
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'city',
	'postcode',
	'country',
	'other'
] as const

export type FieldRole = (typeof FIELD_ROLES)[number]

export type IdentityRole = Exclude<FieldRole, 'other'>

export function isIdentityRole(role: FieldRole): role is IdentityRole {
	return role !== 'other'
}

// Header spellings that suggest a role. Only a suggestion: the mapping screen
// labels it "Suggested" until the user confirms it.
const HEADER_HINTS: Array<[FieldRole, RegExp]> = [
	['email', /e-?mail/],
	['phone', /phone|mobile|tel(ephone)?|cell/],
	['date_of_birth', /birth|dob|birthday/],
	['first_name', /^(first|given|fore)[ _-]?name$|^first$/],
	['last_name', /^(last|family|sur)[ _-]?name$|^surname$|^last$/],
	['full_name', /^(full[ _-]?)?name$|customer[ _-]?name/],
	['postcode', /post[ _-]?code|zip|postal/],
	['city', /city|town/],
	['country', /country/],
	['address', /address|street|line ?1/]
]

export function suggestRole(header: string): FieldRole {
	const normalized = header.trim().toLowerCase()
	return HEADER_HINTS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? 'other'
}

// Suggests the record-reference column: an id-looking header, else the first.
export function suggestReferenceColumn(headers: string[]): string | undefined {
	return (
		headers.find((header) => /^(record[ _-]?)?(id|ref|reference|key)$/i.test(header.trim())) ??
		headers[0]
	)
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
