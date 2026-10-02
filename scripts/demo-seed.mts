// Loads the sandbox's prepared evaluation (prisma/demo/sandbox-snapshot.json)
// into the database as the public read-only sandbox (/sandbox): owner-less,
// kind `demo`, its run and judgments marked `prepared`.
//
// Usage: pnpm demo:seed
//
// Idempotent: it deletes the sandbox evaluation (everything under it goes by
// cascade) and recreates it with the same fixed ids, in one transaction.
// Never calls Jev — the judgments are the recorded ones.

import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { SANDBOX_EVALUATION_ID } from '../src/lib/pairsight/sandbox.ts'
import {
	SANDBOX_ID_KIND,
	sandboxId,
	sandboxSnapshotSchema
} from '../src/lib/pairsight/sandbox-snapshot.ts'

const SNAPSHOT = 'prisma/demo/sandbox-snapshot.json'
const TRANSACTION_TIMEOUT_MS = 30_000

const snapshot = sandboxSnapshotSchema.parse(JSON.parse(readFileSync(SNAPSHOT, 'utf8')))
const db = new PrismaClient()

const datasetId = sandboxId(SANDBOX_ID_KIND.dataset, 1)
const runId = sandboxId(SANDBOX_ID_KIND.run, 1)
const recordIds = new Map(
	snapshot.dataset.records.map((record, index) => [
		record.reference,
		sandboxId(SANDBOX_ID_KIND.record, index + 1)
	])
)
const vendorIds = snapshot.vendors.map((_, index) => sandboxId(SANDBOX_ID_KIND.vendor, index + 1))

function recordId(reference: string): string {
	const id = recordIds.get(reference)
	if (id == null) throw new Error(`The snapshot names an unknown record ${reference}`)
	return id
}

// Pairs are stored with their record ids in canonical order (a < b).
function canonical([first, second]: [string, string]) {
	const a = recordId(first)
	const b = recordId(second)
	return a < b ? { recordAId: a, recordBId: b } : { recordAId: b, recordBId: a }
}

try {
	await db.$transaction(
		async (tx) => {
			await tx.evaluation.deleteMany({ where: { id: SANDBOX_EVALUATION_ID } })
			const { evaluation, dataset, vendors, run } = snapshot
			await tx.evaluation.create({
				data: {
					id: SANDBOX_EVALUATION_ID,
					ownerId: null,
					kind: 'demo',
					name: evaluation.name,
					identitySame: evaluation.identitySame,
					identityDifferent: evaluation.identityDifferent,
					countryCode: evaluation.countryCode,
					jevFields: evaluation.jevFields,
					blockingRules: evaluation.blockingRules ?? [],
					threshold: evaluation.threshold
				}
			})
			await tx.sourceDataset.create({
				data: {
					id: datasetId,
					evaluationId: SANDBOX_EVALUATION_ID,
					fileName: dataset.fileName,
					rowCount: dataset.records.length,
					referenceColumn: dataset.referenceColumn,
					columnRoles: dataset.columnRoles ?? {},
					createdAt: new Date(snapshot.run.createdAt)
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
			for (const [index, vendor] of vendors.entries()) {
				const id = vendorIds[index] ?? ''
				await tx.vendorExport.create({
					data: {
						id,
						evaluationId: SANDBOX_EVALUATION_ID,
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
					evaluationId: SANDBOX_EVALUATION_ID,
					datasetId,
					number: run.number,
					origin: 'prepared',
					status: 'completed',
					identitySame: run.identitySame,
					identityDifferent: run.identityDifferent,
					countryCode: run.countryCode,
					jevFields: run.jevFields,
					blockingRules: run.blockingRules ?? [],
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
					id: sandboxId(SANDBOX_ID_KIND.assessment, index + 1),
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
					id: sandboxId(SANDBOX_ID_KIND.runPair, index + 1),
					runId,
					...canonical(pair.records),
					ruleIds: pair.ruleIds,
					matchedByExportIds: pair.matchedBy.map((vendor) => vendorIds[vendor] ?? ''),
					assessmentId: sandboxId(SANDBOX_ID_KIND.assessment, index + 1)
				}))
			})
		},
		{ timeout: TRANSACTION_TIMEOUT_MS }
	)
	console.log(
		`Seeded the sandbox: ${snapshot.dataset.records.length} records, ${snapshot.vendors.length} vendors, ${snapshot.run.pairs.length} prepared judgments (Jev ${snapshot.run.jevModel}, recorded ${snapshot.recordedAt.slice(0, 10)}).`
	)
} finally {
	await db.$disconnect()
}
