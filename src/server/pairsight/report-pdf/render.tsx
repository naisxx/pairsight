import 'server-only'
import { Font, renderToBuffer } from '@react-pdf/renderer'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { log } from '@/server/lib/logger'
import { exportFileName } from '../export-file-name'
import { reportData } from '../report'
import type { EvaluationScope } from '../scope'
import { ReportDocument } from './document'

const PDF_MIME_TYPE = 'application/pdf'

// Words wrap whole: react-pdf would otherwise hyphenate table headers
// ("Missed du-plicates").
Font.registerHyphenationCallback((word) => [word])

// A run's summary report as a PDF to download. Record values only ever go to
// the viewer in the file: the log line carries ids and counts.
export async function summaryExport({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const [data, t, tRoles, tFailures, format, locale] = await Promise.all([
		reportData({ scope, runId }),
		getTranslations('Report'),
		getTranslations('Roles'),
		getTranslations('Failures'),
		getFormatter(),
		getLocale()
	])
	const listFormat = new Intl.ListFormat(locale, { type: 'conjunction' })
	const body = await renderToBuffer(
		<ReportDocument
			data={data}
			text={{
				t,
				role: (role) => tRoles(role),
				failure: (reason) => tFailures(reason),
				date: (date) => format.dateTime(date, { dateStyle: 'medium' }),
				dateTime: (date) => format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' }),
				count: (value) => format.number(value, 'compact'),
				list: (items) => listFormat.format(items)
			}}
		/>
	)
	log.info('pairsight summary exported', {
		runId,
		vendors: data.report.vendors.length,
		pairs: data.report.pairs.total
	})
	return {
		fileName: exportFileName({
			evaluation: data.evaluationName,
			runNumber: data.runNumber,
			kind: 'summary',
			extension: '.pdf'
		}),
		contentType: PDF_MIME_TYPE,
		body: new Uint8Array(body)
	}
}
