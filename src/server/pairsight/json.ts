import { z } from 'zod'
import type { Prisma } from '@/server/db/client'
import type { FieldRole } from './fields'
import {
	blockingRulesSchema,
	canonicalPairsSchema,
	columnRolesSchema,
	vendorColumnsSchema,
	vendorFileStatsSchema
} from './schemas'

// PairSight's JSON columns, parsed back through their runtime contracts
// rather than cast.

const recordValuesSchema = z.record(z.string(), z.string())

export function parseRecordValues(values: Prisma.JsonValue): Record<string, string> {
	return recordValuesSchema.parse(values)
}

export function parseColumnRoles(value: Prisma.JsonValue): Record<string, FieldRole> {
	return columnRolesSchema.parse(value)
}

export function parseBlockingRules(value: Prisma.JsonValue) {
	return blockingRulesSchema.parse(value)
}

// A vendor's stored columns, stats and pairs; null when not set (a draft
// without a file, an export added before stats were kept). Columns are only
// shown, never computed with, and exports saved before the format tag have
// none to show, so they read leniently.
export function parseVendorColumns(value: Prisma.JsonValue | null) {
	return vendorColumnsSchema.safeParse(value).data ?? null
}

export function parseVendorStats(value: Prisma.JsonValue | null) {
	return value == null ? null : vendorFileStatsSchema.parse(value)
}

export function parseCanonicalPairs(value: Prisma.JsonValue | null) {
	return value == null ? [] : canonicalPairsSchema.parse(value)
}
