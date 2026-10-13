import 'server-only'
import { entityTypeOf, type EntityType } from '@/lib/pairsight/entity-types'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { defaultIdentity } from './judgment'
import type { SourceRecordInput } from './source-records'
import { isIdentityRole, mapRecordFields, type FieldRole } from './fields'
import type { MappedFields } from './normalize'
import { guessCountry } from './profile/country-guess'
import { parseProfile, profileRecords, type DatasetProfile } from './profile/profile'
import { getOwnedEvaluation } from './evaluations'
import { recordKeys } from './record-keys'
import { chunks } from './chunks'

// Records written per statement.
const SAVE_BATCH = 5_000

// The current dataset is the latest fully saved one; older datasets stay
// only for the runs that used them, and one still being written is never
// current.
export async function getCurrentDataset(evaluationId: string) {
	return db.sourceDataset.findFirst({
		where: { evaluationId, savedAt: { not: null } },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			fileName: true,
			rowCount: true,
			referenceColumn: true,
			columnRoles: true,
			profile: true,
			createdAt: true
		}
	})
}

// The evaluation's country for a newly saved file: where the file looks to
// be from (country-guess.ts) if the country is still PairSight's to set,
// else the one it has. It's PairSight's on a first save (the step that
// changes it is locked until then) and while it's still the guess the last
// file applied; once the user picks another, a new file never overwrites it.
async function countryFor({
	evaluationId,
	current,
	mapped
}: {
	evaluationId: string
	current: string
	mapped: MappedFields[]
}): Promise<{ code: string; guess: NonNullable<DatasetProfile['countryGuess']> | null }> {
	const guess = guessCountry(mapped)
	const previous = await getCurrentDataset(evaluationId)
	const previousGuess = previous == null ? null : parseProfile(previous.profile)?.countryGuess
	const isOurs =
		previous == null || (previousGuess?.applied === true && previousGuess.code === current)
	if (guess == null) return { code: current, guess: null }
	return { code: isOurs ? guess.code : current, guess: { ...guess, applied: isOurs } }
}

// Saves a file's records as the evaluation's new dataset. `readRecords`
// reads the (already checked) file and hands its records over a batch at a
// time; they're written as they come, so a file of any size is saved in
// flat memory. The dataset only becomes current once every record is in,
// and a save that fails part-way leaves nothing behind.
export async function saveSourceDataset({
	ownerId,
	evaluationId,
	fileName,
	referenceColumn,
	columnRoles,
	rowCount,
	readRecords,
	entityType
}: {
	ownerId: string
	evaluationId: string
	fileName: string
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	rowCount: number
	readRecords: (write: (records: SourceRecordInput[]) => Promise<void>) => Promise<void>
	entityType: EntityType
}) {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
	const jevFields = [...new Set(Object.values(columnRoles).filter(isIdentityRole))]
	// A replacement of another kind starts from the new type's identity
	// definition, unless the wording is the user's own: that's never thrown
	// away unasked (Rules offers the new type's wording beside it). The same
	// type keeps what the user set.
	const previousType = entityTypeOf(evaluation.entityType)
	const previous = defaultIdentity(previousType)
	const isUntouched =
		evaluation.identitySame.trim() === previous.same.trim() &&
		evaluation.identityDifferent.trim() === previous.different.trim()
	const typeDefaults =
		previousType === entityType || !isUntouched
			? { entityType }
			: {
					entityType,
					identitySame: defaultIdentity(entityType).same,
					identityDifferent: defaultIdentity(entityType).different
				}
	const dataset = await db.sourceDataset.create({
		data: { evaluationId, fileName, rowCount, referenceColumn, columnRoles, savedAt: null },
		select: { id: true }
	})
	// Every record's mapped fields, for its profile: at most a dataset's
	// worth (LIMITS.maxSourceRecords), held while the file is read anyway.
	const mapped: MappedFields[] = []
	const write = async (records: SourceRecordInput[]) => {
		for (const record of records)
			mapped.push(mapRecordFields({ values: record.values, columnRoles }))
		for (const batch of chunks(records, SAVE_BATCH)) {
			await db.sourceRecord.createMany({
				data: batch.map((record) => ({
					datasetId: dataset.id,
					reference: record.reference,
					rowNumber: record.rowNumber,
					values: record.values,
					...recordKeys({
						reference: record.reference,
						values: record.values,
						columnRoles,
						entityType
					})
				}))
			})
		}
	}
	try {
		await readRecords(write)
		const country = await countryFor({ evaluationId, current: evaluation.countryCode, mapped })
		const profile = {
			...profileRecords(mapped, { type: entityType, country: country.code }),
			countryGuess: country.guess
		}
		await db.$transaction([
			// Current now, profiled, and queued for Splink (splink/score-dataset.ts).
			db.sourceDataset.update({
				where: { id: dataset.id },
				data: {
					savedAt: new Date(),
					profile,
					scoreStatus: 'pending',
					scorePool: env.RUN_WORKER_POOL
				}
			}),
			db.evaluation.update({
				where: { id: evaluationId },
				data: { jevFields, countryCode: country.code, ...typeDefaults }
			})
		])
	} catch (error) {
		// Its records go with it (cascade).
		await db.sourceDataset.deleteMany({ where: { id: dataset.id } })
		throw error
	}
	return dataset
}

export async function recordIdsByReference(datasetId: string): Promise<Map<string, string>> {
	const records = await db.sourceRecord.findMany({
		where: { datasetId },
		select: { id: true, reference: true }
	})
	return new Map(records.map((record) => [record.reference, record.id]))
}

// A saved dataset's first rows in file order, for showing it back.
export async function getDatasetPreview(datasetId: string, take: number) {
	return db.sourceRecord.findMany({
		where: { datasetId },
		orderBy: { rowNumber: 'asc' },
		take,
		select: { rowNumber: true, values: true }
	})
}
