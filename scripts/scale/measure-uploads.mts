// Times the upload path on a big records file (docs/PairSight-Scale-Roadmap.md,
// item 3), through the same code the screens use: the upload, the preview
// (every column checked), the save (two passes, records in batches), a
// vendor's file checked and confirmed, then the Rules and Plan pages' work.
// It makes a "Scale check" evaluation in the local database, owned by the
// account given (or the one with most evaluations).
//
// Usage: pnpm scale:measure-uploads                  (the 10K CSV and Excel sets)
//        pnpm scale:measure-uploads --records 100000 (a generated CSV, past the limit)
//        pnpm scale:measure-uploads --email you@example.test

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { defaultIdentity } from '../../src/server/pairsight/judgment.ts'
import { db } from '../../src/server/db/client.ts'
import { getCurrentDataset, recordIdsByReference } from '../../src/server/pairsight/datasets.ts'
import { computePlan } from '../../src/server/pairsight/plan.ts'
import { rulesPreview } from '../../src/server/pairsight/rules-preview.ts'
import { ownerScope } from '../../src/server/pairsight/scope.ts'
import { previewSourceUpload, saveSourceUpload } from '../../src/server/pairsight/source-upload.ts'
import { readTable } from '../../src/server/pairsight/tabular/index.ts'
import { readLimited, readStoredUpload, storeUpload } from '../../src/server/pairsight/uploads.ts'
import {
	confirmVendorDraft,
	createVendorDraft,
	setDraftFile
} from '../../src/server/pairsight/vendor-exports.ts'
import { detectVendorColumns, parseVendorFile } from '../../src/server/pairsight/vendors.ts'
import { LIMITS } from '../../src/server/pairsight/limits.ts'
import { defaultRules } from '../../src/lib/pairsight/entity-types.ts'
import { generatePeople, toCsv } from './people.mts'
import { scaleOwner } from './owner.mts'

const DATASETS = 'C:/Users/onais/Downloads/PairSight - Datasets'
const MB = 1_000_000

const { values: options } = parseArgs({
	options: {
		records: { type: 'string' },
		email: { type: 'string' },
		folder: { type: 'string' }
	}
})
const folder = options.folder ?? DATASETS
const generated = options.records == null ? null : Number(options.records)

const results: Array<[string, number]> = []
let peakRss = process.memoryUsage().rss
const timed = async <T,>(label: string, work: () => Promise<T>): Promise<T> => {
	const started = performance.now()
	const result = await work()
	results.push([label, Math.round(performance.now() - started)])
	peakRss = Math.max(peakRss, process.memoryUsage().rss)
	return result
}
const streamOf = (bytes: Uint8Array) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes)
			controller.close()
		}
	})

const ownerId = await scaleOwner(options.email)

async function measureFile({
	label,
	fileName,
	bytes,
	vendor,
	maxRows
}: {
	label: string
	fileName: string
	bytes: Uint8Array
	vendor: { fileName: string; bytes: Uint8Array } | null
	maxRows: number
}) {
	const identity = defaultIdentity('person')
	const evaluation = await db.evaluation.create({
		data: {
			ownerId,
			name: `Scale check: ${label}`,
			identitySame: identity.same,
			identityDifferent: identity.different,
			jevFields: [],
			blockingRules: defaultRules('person')
		},
		select: { id: true }
	})
	const uploadId = await timed(
		`${label}: upload (${(bytes.length / MB).toFixed(1)} MB)`,
		async () =>
			storeUpload({
				ownerId,
				evaluationId: evaluation.id,
				kind: 'records',
				fileName,
				bytes: await readLimited(streamOf(bytes))
			})
	)
	const preview = await timed(`${label}: preview, every column checked`, () =>
		previewSourceUpload({ ownerId, uploadId, maxRows })
	)
	if (!preview.ok) throw new Error(`${label}: preview failed (${preview.error.code})`)
	const saved = await timed(`${label}: save (check, then records in batches)`, () =>
		saveSourceUpload({
			ownerId,
			evaluationId: evaluation.id,
			uploadId,
			referenceColumn: 'record_id',
			columnRoles: preview.suggestedRoles.person,
			entityType: 'person',
			maxRows
		})
	)
	if (!saved.ok) throw new Error(`${label}: save failed`)
	if (vendor != null) {
		const dataset = await getCurrentDataset(evaluation.id)
		if (dataset == null) throw new Error('no dataset')
		const draft = await createVendorDraft({ ownerId, evaluationId: evaluation.id })
		const vendorUpload = await storeUpload({
			ownerId,
			evaluationId: evaluation.id,
			kind: 'vendor',
			fileName: vendor.fileName,
			bytes: await readLimited(streamOf(vendor.bytes))
		})
		await timed(`${label}: vendor file checked`, async () => {
			const upload = await readStoredUpload({ ownerId, uploadId: vendorUpload, kind: 'vendor' })
			const parsed = await readTable({
				fileName: upload.fileName,
				bytes: upload.bytes,
				maxRows: LIMITS.maxVendorRows
			})
			if (!parsed.ok) throw new Error('vendor file unreadable')
			const recordIdByReference = await recordIdsByReference(dataset.id)
			const detected = detectVendorColumns({
				table: parsed.table,
				references: new Set(recordIdByReference.keys())
			})
			if (detected.columns == null) throw new Error('vendor columns not found')
			const result = parseVendorFile({
				table: parsed.table,
				columns: detected.columns,
				recordIdByReference,
				maxPairs: LIMITS.maxVendorRows
			})
			await setDraftFile({
				ownerId,
				draftId: draft.id,
				fileName: upload.fileName,
				columns: detected.columns,
				pairs: result.pairs,
				stats: result.stats
			})
		})
		await timed(`${label}: vendor confirmed`, () =>
			confirmVendorDraft({ ownerId, draftId: draft.id })
		)
	}
	const scope = ownerScope(ownerId)
	await timed(`${label}: Rules page (rules preview + plan)`, () =>
		Promise.all([
			rulesPreview({ scope, evaluationId: evaluation.id }),
			computePlan({ scope, evaluationId: evaluation.id })
		])
	)
	await timed(`${label}: Plan page`, () => computePlan({ scope, evaluationId: evaluation.id }))
	return saved.rowCount
}

if (generated == null) {
	const read = (name: string) => readFile(path.join(folder, name))
	const vendor = { fileName: 'vendor.csv', bytes: await read('people-10k-vendor-aggressive.csv') }
	await measureFile({
		label: '10K CSV',
		fileName: 'people-10k-records.csv',
		bytes: await read('people-10k-records.csv'),
		vendor,
		maxRows: LIMITS.maxSourceRecords
	})
	await measureFile({
		label: '10K Excel',
		fileName: 'people-10k-records.xlsx',
		bytes: await read('people-10k-records.xlsx'),
		vendor: null,
		maxRows: LIMITS.maxSourceRecords
	})
} else {
	const { rows } = generatePeople(generated)
	await measureFile({
		label: `${generated.toLocaleString('en-GB')} CSV`,
		fileName: 'people.csv',
		bytes: new TextEncoder().encode(toCsv(rows)),
		vendor: null,
		maxRows: generated
	})
}

await db.$disconnect()
for (const [label, ms] of results) console.log(`${String(ms).padStart(7)} ms  ${label}`)
console.log(`peak memory ${(peakRss / MB).toFixed(0)} MB`)
