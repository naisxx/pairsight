import { rolesFor, type EntityType, type IdentityRole } from '@/lib/pairsight/entity-types'
import type { DatasetProfile } from './profile'

// What Records says about a file's profile (profile.ts): only what changes
// how PairSight picks pairs, so a clean file gets one quiet line.

// Stand-ins named per field: more than this and the rest are counted.
const SHOWN_VALUES = 3
// Unreadable values are worth a line from this many, and this share of the
// field: a stray typo isn't news.
const UNREADABLE_MIN = 5
const UNREADABLE_SHARE = 0.01

export type HealthFinding =
	| { kind: 'filler'; role: IdentityRole; values: string[]; more: number; count: number }
	| { kind: 'overused'; role: IdentityRole; value: string; count: number }
	| { kind: 'dates'; order: 'dmy' | 'mdy'; assumed: boolean }
	| { kind: 'unreadable'; role: IdentityRole; count: number }

export function healthFindings(profile: DatasetProfile, type: EntityType): HealthFinding[] {
	const findings: HealthFinding[] = []
	for (const role of rolesFor(type)) {
		const field = profile.fields[role]
		if (field == null) continue
		const fillers = field.placeholders.filter(({ reason }) => reason === 'filler')
		if (fillers.length > 0) {
			findings.push({
				kind: 'filler',
				role,
				values: fillers.slice(0, SHOWN_VALUES).map(({ shown }) => shown),
				more: Math.max(0, fillers.length - SHOWN_VALUES),
				count: fillers.reduce((sum, { count }) => sum + count, 0)
			})
		}
		for (const { shown, count } of field.placeholders.filter(
			({ reason }) => reason === 'overused'
		)) {
			findings.push({ kind: 'overused', role, value: shown, count })
		}
		if (field.unreadable >= Math.max(UNREADABLE_MIN, field.filled * UNREADABLE_SHARE)) {
			findings.push({ kind: 'unreadable', role, count: field.unreadable })
		}
	}
	if (profile.dates.order != null) {
		findings.push({ kind: 'dates', order: profile.dates.order, assumed: profile.dates.assumed })
	}
	return findings
}

// Each mapped field's share of records with a value (0 to 1), in field
// order, for the "how full" tip.
export function fillRates(
	profile: DatasetProfile,
	type: EntityType
): Array<{ role: IdentityRole; share: number }> {
	if (profile.records === 0) return []
	return rolesFor(type).flatMap((role) => {
		const field = profile.fields[role]
		return field == null ? [] : [{ role, share: field.filled / profile.records }]
	})
}
