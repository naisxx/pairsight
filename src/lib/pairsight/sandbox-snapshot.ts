import { z } from 'zod'
import { ENTITY_TYPES, type EntityType } from './entity-types'

// The sandbox's prepared evaluation as a file (prisma/demo/sandbox-snapshot.json):
// a real run recorded once against Jev, by record reference rather than by
// database id, so `pnpm demo:seed` can recreate it with fixed ids anywhere.
// Written by scripts/demo-snapshot.mts, read by scripts/demo-seed.mts.

const json = z.json()
const isoDate = z.iso.datetime({ offset: true })
// A pair, by the two records' references.
const pairRefs = z.tuple([z.string(), z.string()])

export const sandboxSnapshotSchema = z.object({
	// 2: PairSight picks the pairs; no rules, each pair says whether it was
	// suggested, and the dataset carries its suggestions.
	version: z.literal(2),
	recordedAt: isoDate,
	evaluation: z.object({
		name: z.string(),
		// Snapshots from before entity types hold people.
		entityType: z.enum(ENTITY_TYPES).default('person'),
		identitySame: z.string(),
		identityDifferent: z.string(),
		countryCode: z.string(),
		jevFields: z.array(z.string()),
		threshold: z.number()
	}),
	dataset: z.object({
		fileName: z.string(),
		referenceColumn: z.string(),
		columnRoles: json,
		records: z.array(
			z.object({
				reference: z.string(),
				rowNumber: z.number().int(),
				values: z.record(z.string(), z.string())
			})
		),
		// PairSight's suggestions for these records, as scored when the run was
		// recorded (pair_scores, at or above the plan's floor), so the sandbox
		// shows them without scoring again.
		suggestions: z.object({
			summary: json,
			pairs: z.array(
				z.object({
					records: pairRefs,
					matchWeight: z.number(),
					matchProbability: z.number(),
					reasons: z.array(z.string())
				})
			)
		})
	}),
	vendors: z.array(
		z.object({
			name: z.string(),
			format: z.enum(['pair', 'group']),
			fileName: z.string(),
			mapping: json,
			stats: json,
			matches: z.array(pairRefs)
		})
	),
	run: z.object({
		number: z.number().int(),
		identitySame: z.string(),
		identityDifferent: z.string(),
		countryCode: z.string(),
		jevFields: z.array(z.string()),
		judgmentKey: z.string(),
		jevModel: z.string(),
		threshold: z.number(),
		initialThreshold: z.number().nullable(),
		createdAt: isoDate,
		completedAt: isoDate,
		pairs: z.array(
			z.object({
				records: pairRefs,
				isSuggested: z.boolean(),
				// Indexes into `vendors`.
				matchedBy: z.array(z.number().int()),
				assessment: z.object({
					status: z.enum(['succeeded', 'failed']),
					score: z.number().nullable(),
					modelReported: z.string().nullable(),
					attempts: z.number().int(),
					errorCode: z.string().nullable(),
					completedAt: isoDate.nullable()
				})
			})
		)
	})
})

export type SandboxSnapshot = z.infer<typeof sandboxSnapshotSchema>

const ID_PREFIX = '5a4db0c0'

// Each sandbox's snapshot file, one per entity type.
export const SANDBOX_SNAPSHOTS: Record<EntityType, string> = {
	person: 'prisma/demo/sandbox-snapshot.json',
	company: 'prisma/demo/sandbox-companies-snapshot.json',
	product: 'prisma/demo/sandbox-products-snapshot.json'
}

// The UUID variant digit tells the three sandboxes' rows apart; people keep
// the ids they had before there were three.
const TYPE_DIGIT: Record<EntityType, string> = { person: '8', company: '9', product: 'a' }

// Fixed ids for everything the seed creates: `5a4db0c0-<kind>-4000-<t>000-<n>`,
// so seeding twice yields the same rows and the sandbox URLs never change.
export function sandboxId(kind: number, index: number, type: EntityType = 'person'): string {
	const kindHex = kind.toString(16).padStart(4, '0')
	const indexHex = index.toString(16).padStart(12, '0')
	return `${ID_PREFIX}-${kindHex}-4000-${TYPE_DIGIT[type]}000-${indexHex}`
}

export const SANDBOX_ID_KIND = {
	evaluation: 0,
	dataset: 1,
	record: 2,
	vendor: 3,
	run: 4,
	runPair: 5,
	assessment: 6
} as const
