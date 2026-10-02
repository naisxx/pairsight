import 'server-only'
import { getTranslations } from 'next-intl/server'
import type { TabularFormat } from '@/lib/pairsight/tabular-formats'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { db } from '@/server/db/client'
import { log } from '@/server/lib/logger'
import { buildFindings } from './findings-table'
import { parseBlockingRules } from './json'
import { loadRunView } from './results'
import type { EvaluationScope } from './scope'
import { adapterFor, writeTable } from './tabular'

// A run's findings as a file to download (one row per pair, every vendor as
// columns), through the tabular connector, so other formats come for free.
// Record values only ever go to the viewer in the file: the log line carries
// ids and counts.

const MAX_SLUG_LENGTH = 40

function slug(name: string): string {
	const cleaned = name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LENGTH)
	return cleaned === '' ? 'evaluation' : cleaned
}

export async function findingsExport({
	scope,
	runId,
	format
}: {
	scope: EvaluationScope
	runId: string
	format: TabularFormat
}) {
	const [view, t, tCat, tRules, tRoles, tFailures] = await Promise.all([
		loadRunView({ scope, runId }),
		getTranslations('Export'),
		getTranslations('Categories'),
		getTranslations('Rules'),
		getTranslations('Roles'),
		getTranslations('Failures')
	])
	const { run } = view
	const evaluation = await db.evaluation.findUniqueOrThrow({
		where: { id: run.evaluationId },
		select: { name: true }
	})
	const rules = parseBlockingRules(run.blockingRules)
	const table = buildFindings({
		pairs: view.pairs,
		records: view.recordsById,
		columnRoles: view.columnRoles,
		vendors: view.vendors,
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
	const body = await writeTable(table, format)
	log.info('pairsight findings exported', { runId, rows: table.rows.length, format })
	return {
		fileName: `pairsight-${slug(evaluation.name)}-run-${run.number}-findings${adapter.extension}`,
		contentType: adapter.mimeType,
		body
	}
}
