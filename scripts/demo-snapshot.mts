// Freezes a finished evaluation as the sandbox's prepared snapshot
// (prisma/demo/sandbox-snapshot.json). Run once after recording a real run on
// fictional data — see docs/PairSight-Delivery-Plan.md, M4.
//
// Usage: pnpm demo:snapshot <evaluationId>
//
// The evaluation must hold fictional records only: they're committed. Ids
// are replaced by record references, so the seed can recreate it anywhere.

import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { format, resolveConfig } from 'prettier'
import {
	sandboxSnapshotSchema,
	type SandboxSnapshot
} from '../src/lib/pairsight/sandbox-snapshot.ts'

const OUT = 'prisma/demo/sandbox-snapshot.json'
const evaluationId = process.argv[2]
if (evaluationId == null) {
	console.error('Usage: pnpm demo:snapshot <evaluationId>')
	process.exit(1)
}

const db = new PrismaClient()
try {
	const evaluation = await db.evaluation.findUniqueOrThrow({ where: { id: evaluationId } })
	const run = await db.run.findFirstOrThrow({
		where: { evaluationId, status: 'completed' },
		orderBy: { number: 'desc' },
		include: { pairs: { include: { assessment: true } } }
	})
	if (run.completedAt == null) throw new Error('The run has no completion time')
	const dataset = await db.sourceDataset.findUniqueOrThrow({
		where: { id: run.datasetId },
		include: { records: { orderBy: { rowNumber: 'asc' } } }
	})
	const vendors = await db.vendorExport.findMany({
		where: { id: { in: run.exportIds } },
		orderBy: { createdAt: 'asc' },
		include: { matches: true }
	})
	const referenceOf = new Map(dataset.records.map((record) => [record.id, record.reference]))
	const refs = (a: string, b: string): [string, string] => {
		const first = referenceOf.get(a)
		const second = referenceOf.get(b)
		if (first == null || second == null)
			throw new Error('A pair names a record outside the dataset')
		return [first, second]
	}
	const vendorIndex = new Map(vendors.map((vendor, index) => [vendor.id, index]))

	const snapshot: SandboxSnapshot = {
		version: 1,
		recordedAt: run.completedAt.toISOString(),
		evaluation: {
			name: evaluation.name,
			identitySame: evaluation.identitySame,
			identityDifferent: evaluation.identityDifferent,
			countryCode: evaluation.countryCode,
			jevFields: evaluation.jevFields,
			blockingRules: evaluation.blockingRules,
			threshold: evaluation.threshold
		},
		dataset: {
			fileName: dataset.fileName,
			referenceColumn: dataset.referenceColumn,
			columnRoles: dataset.columnRoles,
			records: dataset.records.map((record) => ({
				reference: record.reference,
				rowNumber: record.rowNumber,
				values: Object.fromEntries(
					Object.entries(record.values ?? {}).map(([key, value]) => [key, String(value)])
				)
			}))
		},
		vendors: vendors.map((vendor) => ({
			name: vendor.name,
			format: vendor.format,
			fileName: vendor.fileName,
			mapping: vendor.mapping,
			stats: vendor.stats ?? null,
			matches: vendor.matches.map((match) => refs(match.recordAId, match.recordBId))
		})),
		run: {
			number: 1,
			identitySame: run.identitySame,
			identityDifferent: run.identityDifferent,
			countryCode: run.countryCode,
			jevFields: run.jevFields,
			blockingRules: run.blockingRules,
			judgmentKey: run.judgmentKey,
			jevModel: run.jevModel,
			threshold: run.threshold,
			initialThreshold: run.initialThreshold,
			createdAt: run.createdAt.toISOString(),
			completedAt: run.completedAt.toISOString(),
			pairs: run.pairs.map((pair) => {
				const { assessment } = pair
				if (assessment.status !== 'succeeded' && assessment.status !== 'failed') {
					throw new Error('The run still has unfinished pairs')
				}
				return {
					records: refs(pair.recordAId, pair.recordBId),
					ruleIds: pair.ruleIds,
					matchedBy: pair.matchedByExportIds.flatMap((id) => vendorIndex.get(id) ?? []),
					assessment: {
						status: assessment.status,
						score: assessment.score,
						modelReported: assessment.modelReported,
						attempts: assessment.attempts,
						errorCode: assessment.errorCode,
						completedAt: assessment.completedAt?.toISOString() ?? null
					}
				}
			})
		}
	}
	const checked = sandboxSnapshotSchema.parse(snapshot)
	// Written the way the repo formats it, so format:check passes as is.
	const options = await resolveConfig(OUT)
	writeFileSync(
		OUT,
		await format(JSON.stringify(checked, null, '\t'), { ...options, filepath: OUT })
	)
	console.log(
		`Wrote ${OUT}: ${checked.dataset.records.length} records, ${checked.vendors.length} vendors, ${checked.run.pairs.length} pairs (Jev ${checked.run.jevModel}).`
	)
} finally {
	await db.$disconnect()
}
