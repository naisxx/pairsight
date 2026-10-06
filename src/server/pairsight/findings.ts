import 'server-only'
import { getTranslations } from 'next-intl/server'
import { XLSX_MAX_ROWS, type TabularFormat } from '@/lib/pairsight/tabular-formats'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { db } from '@/server/db/client'
import { log } from '@/server/lib/logger'
import { exportFileName } from './export-file-name'
import { AppError } from '@/lib/errors/app-error'
import { findingsColumns } from './findings-table'
import { parseBlockingRules, parseColumnRoles, parseRecordValues } from './json'
import { ensureRecordKeys } from './record-keys'
import { runPairPages } from './results-query'
import { runVendors } from './run-summary'
import { getVisibleRun, runNotFinished } from './runs'
import type { EvaluationScope } from './scope'
import { adapterFor } from './tabular'
import { streamTable, type RowPages } from './tabular/stream'

export function tooManyRowsForExcel() {
	return new AppError(
		'This run has too many pairs for one Excel sheet. Download the CSV instead.',
		{
			status: 409,
			code: 'too_many_rows_for_excel'
		}
	)
}

// A run's findings as a file to download (one row per pair, every vendor as
// columns), through the tabular connector, so other formats come for free.
// Streamed a page at a time, so a run of any size downloads in flat memory.
// Record values only ever go to the viewer in the file: the log line carries
// ids and counts.

export async function findingsExport({
	scope,
	runId,
	format
}: {
	scope: EvaluationScope
	runId: string
	format: TabularFormat
}) {
	const run = await getVisibleRun({ scope, runId })
	if (run.status !== 'completed') throw runNotFinished()
	if (format === 'xlsx' && run.pairCount > XLSX_MAX_ROWS) throw tooManyRowsForExcel()
	const [vendors, dataset, t, tCat, tRules, tRoles, tFailures] = await Promise.all([
		runVendors(run.exportIds),
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { columnRoles: true }
		}),
		getTranslations('Export'),
		getTranslations('Categories'),
		getTranslations('Rules'),
		getTranslations('Roles'),
		getTranslations('Failures'),
		ensureRecordKeys({ datasetId: run.datasetId, entityType: run.entityType })
	])
	const rules = parseBlockingRules(run.blockingRules)
	const { headers, row } = findingsColumns({
		columnRoles: parseColumnRoles(dataset.columnRoles),
		vendors,
		threshold: run.threshold,
		labels: {
			recordA: t('recordA'),
			recordB: t('recordB'),
			field: (side, role) => t('field', { side, field: tRoles(role) }),
			jevStatus: t('jevStatus'),
			jevScore: t('jevScore'),
			jevModel: t('jevModel'),
			assessedAt: t('assessedAt'),
			failure: t('failure'),
			decision: t('decision'),
			lowConfidence: t('lowConfidence'),
			foundBy: t('foundBy'),
			vendorDecision: (vendor) => t('vendorDecision', { vendor }),
			vendorCategory: (vendor) => t('vendorCategory', { vendor }),
			status: (status) => t(`status_${status}`),
			failureReason: (reason) => tFailures(reason),
			match: t('match'),
			noMatch: t('noMatch'),
			incomplete: t('incomplete'),
			yes: t('yes'),
			no: t('no'),
			matched: t('matched'),
			notMatched: t('notMatched'),
			addedByVendor: t('addedByVendor'),
			category: (category) => (category === 'incomplete' ? t('incomplete') : tCat(category)),
			rule: (ruleId) => ruleLabel({ ruleId, rules, tRules, tRoles })
		}
	})
	const adapter = adapterFor(format)
	async function* pages(): RowPages {
		let rows = 0
		for await (const page of runPairPages({ runId, datasetId: run.datasetId })) {
			rows += page.length
			yield page.map((pair) =>
				row(
					{ ...pair, assessment: pair },
					{ reference: pair.referenceA, values: parseRecordValues(pair.valuesA) },
					{ reference: pair.referenceB, values: parseRecordValues(pair.valuesB) }
				)
			)
		}
		log.info('pairsight findings exported', { runId, rows, format })
	}
	return {
		fileName: exportFileName({
			evaluation: run.evaluation.name,
			runNumber: run.number,
			kind: 'findings',
			extension: adapter.extension
		}),
		contentType: adapter.mimeType,
		body: streamTable({ headers, pages: pages(), format })
	}
}
