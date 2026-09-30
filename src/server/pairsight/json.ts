import { z } from 'zod'
import type { Prisma } from '@/server/db/client'
import type { FieldRole } from './fields'
import { blockingRulesSchema, columnRolesSchema } from './schemas'

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
