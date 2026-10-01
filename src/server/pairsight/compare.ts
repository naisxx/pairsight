import { FIELD_ROLES, isIdentityRole, type FieldRole, type IdentityRole } from './fields'
import { normalizeField } from './normalize'

// Field-by-field comparison of two records for the Pair detail screen. Display
// only — it never feeds a decision (Jev does that). Values are compared after
// the same normalization blocking uses, so "Jane.Smith@Example.com" and
// "jane.smith@example.com" read as the same.

export type Comparison = 'same' | 'different' | 'oneMissing' | 'bothMissing'

export type FieldComparison = {
	role: IdentityRole
	header: string
	a: string
	b: string
	comparison: Comparison
	// Same after normalizing, but written differently ("+44 7700…" / "07700…").
	isFormatOnly: boolean
}

export function compareFields({
	valuesA,
	valuesB,
	columnRoles,
	country
}: {
	valuesA: Record<string, string>
	valuesB: Record<string, string>
	columnRoles: Record<string, FieldRole>
	country: string
}): { fields: FieldComparison[]; otherHeaders: string[] } {
	const fields = FIELD_ROLES.filter(isIdentityRole).flatMap((role) => {
		const header = Object.entries(columnRoles).find(([, mapped]) => mapped === role)?.[0]
		if (header == null) return []
		const a = valuesA[header] ?? ''
		const b = valuesB[header] ?? ''
		const normalize = (value: string) =>
			normalizeField({ field: role, fields: { [role]: value }, country }) ?? value
		const comparison: Comparison =
			a === '' && b === ''
				? 'bothMissing'
				: a === '' || b === ''
					? 'oneMissing'
					: normalize(a) === normalize(b)
						? 'same'
						: 'different'
		const isFormatOnly = comparison === 'same' && a.trim() !== b.trim()
		return [{ role, header, a, b, comparison, isFormatOnly }]
	})
	const otherHeaders = Object.keys(valuesA).filter(
		(header) => !fields.some((field) => field.header === header)
	)
	return { fields, otherHeaders }
}
