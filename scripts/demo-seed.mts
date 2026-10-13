// Loads the sandbox's prepared evaluations (one snapshot per entity type,
// SANDBOX_SNAPSHOTS) into the database as the public read-only sandbox
// (/sandbox): owner-less, kind `demo`, their runs and judgments marked
// `prepared`. A type without a snapshot file is skipped.
//
// Usage: pnpm demo:seed
//
// Idempotent: it deletes each sandbox evaluation (everything under it goes by
// cascade) and recreates it with the same fixed ids, in one transaction.
// Never calls Jev — the judgments are the recorded ones.

import { existsSync, readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { chunks } from '../src/server/pairsight/chunks.ts'
import { ENTITY_TYPES, type EntityType } from '../src/lib/pairsight/entity-types.ts'
import { SANDBOX_EVALUATION_IDS } from '../src/lib/pairsight/sandbox.ts'
import { mapRecordFields, type FieldRole } from '../src/server/pairsight/fields.ts'
import { parseColumnRoles } from '../src/server/pairsight/json.ts'
import { guessCountry } from '../src/server/pairsight/profile/country-guess.ts'
import { profileRecords } from '../src/server/pairsight/profile/profile.ts'
import {
	SANDBOX_ID_KIND,
	SANDBOX_SNAPSHOTS,
	sandboxId,
	sandboxSnapshotSchema
} from '../src/lib/pairsight/sandbox-snapshot.ts'

const TRANSACTION_TIMEOUT_MS = 120_000
// Suggested pairs written per statement.
const SCORE_BATCH = 5_000

const db = new PrismaClient()

// A demo file's profile, as an upload gets one (datasets.ts), so its Records
// page shows "What we noticed in this file" like any other. Its country is
// the recorded one; where the file looks to be from is said only when the
// two agree.
function demoProfile({
	records,
	columnRoles,
	type,
	country
}: {
	records: Array<{ values: Record<string, string> }>
	columnRoles: Record<string, FieldRole>
	type: EntityType
	country: string
}) {
	const mapped = records.map(({ values }) => mapRecordFields({ values, columnRoles }))
	const guess = guessCountry(mapped)
	return {
		...profileRecords(mapped, { type, country }),
		countryGuess: guess == null ? null : { ...guess, applied: guess.code === country }
	}
}

async function seed(type: EntityType, file: string) {
	const snapshot = sandboxSnapshotSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
	const evaluationId = SANDBOX_EVALUATION_IDS[type]
	const id = (kind: number, index: number) => sandboxId(kind, index, type)
	const datasetId = id(SANDBOX_ID_KIND.dataset, 1)
	const runId = id(SANDBOX_ID_KIND.run, 1)
	const recordIds = new Map(
		snapshot.dataset.records.map((record, index) => [
			record.reference,
			id(SANDBOX_ID_KIND.record, index + 1)
		])
	)
	const vendorIds = snapshot.vendors.map((_, index) => id(SANDBOX_ID_KIND.vendor, index + 1))

	function recordId(reference: string): string {
		const found = recordIds.get(reference)
		if (found == null) throw new Error(`The snapshot names an unknown record ${reference}`)
		return found
	}

	// Pairs are stored with their record ids in canonical order (a < b).
	function canonical([first, second]: [string, string]) {
		const a = recordId(first)
		const b = recordId(second)
		return a < b ? { recordAId: a, recordBId: b } : { recordAId: b, recordBId: a }
	}

	await db.$transaction(
		async (tx) => {
			await tx.evaluation.deleteMany({ where: { id: evaluationId } })
			const { evaluation, dataset, vendors, run } = snapshot
			await tx.evaluation.create({
				data: {
					id: evaluationId,
					ownerId: null,
					kind: 'demo',
					entityType: type,
					name: evaluation.name,
					identitySame: evaluation.identitySame,
					identityDifferent: evaluation.identityDifferent,
					countryCode: evaluation.countryCode,
					jevFields: evaluation.jevFields,
					threshold: evaluation.threshold
				}
			})
			await tx.sourceDataset.create({
				data: {
					id: datasetId,
					evaluationId,
					fileName: dataset.fileName,
					rowCount: dataset.records.length,
					referenceColumn: dataset.referenceColumn,
					columnRoles: dataset.columnRoles ?? {},
					profile: demoProfile({
						records: dataset.records,
						columnRoles: parseColumnRoles(dataset.columnRoles ?? {}),
						type,
						country: evaluation.countryCode
					}),
					createdAt: new Date(snapshot.run.createdAt),
					// Scored when it was recorded: the suggestions below.
					scoreStatus: 'done',
					scoredAt: new Date(snapshot.run.createdAt),
					scoreSummary: dataset.suggestions.summary ?? {}
				}
			})
			await tx.sourceRecord.createMany({
				data: dataset.records.map((record) => ({
					id: recordId(record.reference),
					datasetId,
					reference: record.reference,
					rowNumber: record.rowNumber,
					values: record.values
				}))
			})
			for (const batch of chunks(dataset.suggestions.pairs, SCORE_BATCH)) {
				await tx.pairScore.createMany({
					data: batch.map((pair) => {
						const { recordAId, recordBId } = canonical(pair.records)
						return {
							datasetId,
							recordAId,
							recordBId,
							matchWeight: pair.matchWeight,
							matchProbability: pair.matchProbability,
							reasons: pair.reasons
						}
					})
				})
			}
			for (const [index, vendor] of vendors.entries()) {
				const id = vendorIds[index] ?? ''
				await tx.vendorExport.create({
					data: {
						id,
						evaluationId,
						datasetId,
						name: vendor.name,
						format: vendor.format,
						fileName: vendor.fileName,
						mapping: vendor.mapping ?? {},
						stats: vendor.stats ?? undefined,
						pairCount: vendor.matches.length,
						confirmedCompleteAt: new Date(snapshot.run.createdAt)
					}
				})
				await tx.vendorMatch.createMany({
					data: vendor.matches.map((match) => ({ exportId: id, ...canonical(match) }))
				})
			}
			await tx.run.create({
				data: {
					id: runId,
					evaluationId,
					datasetId,
					number: run.number,
					origin: 'prepared',
					entityType: type,
					status: 'completed',
					identitySame: run.identitySame,
					identityDifferent: run.identityDifferent,
					countryCode: run.countryCode,
					jevFields: run.jevFields,
					exportIds: vendorIds,
					judgmentKey: run.judgmentKey,
					jevModel: run.jevModel,
					threshold: run.threshold,
					initialThreshold: run.initialThreshold,
					pairCount: run.pairs.length,
					createdAt: new Date(run.createdAt),
					completedAt: new Date(run.completedAt)
				}
			})
			await tx.assessment.createMany({
				data: run.pairs.map((pair, index) => ({
					id: id(SANDBOX_ID_KIND.assessment, index + 1),
					datasetId,
					...canonical(pair.records),
					judgmentKey: run.judgmentKey,
					origin: 'prepared' as const,
					status: pair.assessment.status,
					score: pair.assessment.score,
					modelReported: pair.assessment.modelReported,
					attempts: pair.assessment.attempts,
					errorCode: pair.assessment.errorCode,
					completedAt:
						pair.assessment.completedAt == null ? null : new Date(pair.assessment.completedAt),
					createdAt: new Date(run.createdAt)
				}))
			})
			await tx.runPair.createMany({
				data: run.pairs.map((pair, index) => ({
					id: id(SANDBOX_ID_KIND.runPair, index + 1),
					runId,
					...canonical(pair.records),
					isSuggested: pair.isSuggested,
					matchedByExportIds: pair.matchedBy.map((vendor) => vendorIds[vendor] ?? ''),
					assessmentId: id(SANDBOX_ID_KIND.assessment, index + 1)
				}))
			})
		},
		{ timeout: TRANSACTION_TIMEOUT_MS }
	)
	console.log(
		`Seeded the ${type} sandbox: ${snapshot.dataset.records.length} records, ${snapshot.vendors.length} vendors, ${snapshot.run.pairs.length} prepared judgments (Jev ${snapshot.run.jevModel}, recorded ${snapshot.recordedAt.slice(0, 10)}).`
	)
}

try {
	for (const type of ENTITY_TYPES) {
		const file = SANDBOX_SNAPSHOTS[type]
		if (existsSync(file)) await seed(type, file)
		else console.log(`No ${type} snapshot (${file}); skipped.`)
	}
} finally {
	await db.$disconnect()
}
