import { Document, Page, Text, View } from '@react-pdf/renderer'
import { thresholdPreset } from '@/lib/pairsight/decisions'
import type { ReportData } from '../report'
import type { VendorDetail } from '../report-summary'
import {
	decimal,
	ExampleCard,
	KeyValue,
	percent,
	Scorecard,
	SensitivityChart,
	type ReportText
} from './parts'
import { styles } from './styles'

export type { ReportText } from './parts'

// The summary report (docs/PairSight-UX-Plan.md, "Summary report"), written
// for whoever has to justify a vendor choice: the verdict and scorecard, what
// each vendor gets wrong, example pairs, then the method behind it all.

type Props = { data: ReportData; text: ReportText & { list: (items: string[]) => string } }

// Two separate fixed texts: react-pdf drops a page-number text that shares
// a row with another.
function Footer({ data, text }: Props) {
	return (
		<>
			<Text style={styles.footer} fixed>
				{text.t('footer', { evaluation: data.evaluationName, number: data.runNumber })}
			</Text>
			<Text
				style={[styles.footer, styles.pageNumber]}
				fixed
				render={({ pageNumber, totalPages }) =>
					text.t('page', { page: pageNumber, total: totalPages })
				}
			/>
		</>
	)
}

function Verdict({ data, text }: Props) {
	const { t } = text
	const { vendors, leaders, leadRange } = data.report
	const byId = new Map(vendors.map((vendor) => [vendor.id, vendor]))
	const best = leaders.best == null ? undefined : byId.get(leaders.best)
	const b = (chunks: React.ReactNode) => <Text style={styles.bold}>{chunks}</Text>
	if (best == null) return <Text style={styles.verdictLead}>{t('verdictNone')}</Text>
	if (vendors.length === 1) {
		return (
			<Text style={styles.verdictLead}>
				{t.rich('verdictSingle', {
					records: data.recordCount,
					vendor: best.name,
					f1: decimal(best.metrics.f1),
					precision: percent(best.metrics.precision),
					recall: percent(best.metrics.recall),
					b
				})}
			</Text>
		)
	}
	const safest = leaders.safest == null ? undefined : byId.get(leaders.safest)
	const complete = leaders.mostComplete == null ? undefined : byId.get(leaders.mostComplete)
	const leader = leadRange == null ? undefined : byId.get(leadRange.leader)
	const name = (id: string) => byId.get(id)?.name ?? ''
	return (
		<>
			<Text style={styles.verdictLead}>
				{t.rich('verdict', {
					records: data.recordCount,
					vendor: best.name,
					f1: decimal(best.metrics.f1),
					b
				})}
			</Text>
			{safest != null && safest.id !== best.id && (
				<Text style={styles.paragraph}>
					{t.rich('safest', {
						vendor: safest.name,
						share: percent(safest.metrics.precision == null ? null : 1 - safest.metrics.precision),
						b
					})}
				</Text>
			)}
			{complete != null && complete.id !== best.id && (
				<Text style={styles.paragraph}>
					{t.rich('mostComplete', {
						vendor: complete.name,
						share: percent(complete.metrics.recall),
						b
					})}
				</Text>
			)}
			{leadRange != null && leader != null && (
				<Text style={styles.paragraph}>
					{leadRange.below == null && leadRange.above == null
						? t('leadsEverywhere', {
								vendor: leader.name,
								from: decimal(leadRange.from),
								to: decimal(leadRange.to)
							})
						: [
								t('leadsRange', {
									vendor: leader.name,
									from: decimal(leadRange.from),
									to: decimal(leadRange.to)
								}),
								leadRange.below == null
									? null
									: t('leadBelow', {
											threshold: decimal(leadRange.below.threshold),
											vendor: name(leadRange.below.leader)
										}),
								leadRange.above == null
									? null
									: t('leadAbove', {
											threshold: decimal(leadRange.above.threshold),
											vendor: name(leadRange.above.leader)
										})
							]
								.filter((sentence) => sentence != null)
								.join(' ')}
				</Text>
			)}
		</>
	)
}

function SummaryPage({ data, text }: Props) {
	const { t } = text
	const preset = thresholdPreset(data.threshold)
	const incomplete = data.report.pairs.counts.incomplete
	const prepared =
		data.preparedBy == null
			? t('preparedBySandbox')
			: data.preparedBy === ''
				? null
				: t('preparedBy', { name: data.preparedBy })
	return (
		<Page size="A4" style={styles.page}>
			<Text style={styles.eyebrow}>{t('eyebrow')}</Text>
			<Text style={styles.title}>{t('title')}</Text>
			<Text style={styles.subtitle}>
				{t('subtitle', { evaluation: data.evaluationName, number: data.runNumber })}
			</Text>
			<Text style={styles.meta}>
				{[
					prepared,
					t('generated', { date: text.date(new Date()) }),
					t('thresholdValue', {
						threshold: decimal(data.threshold),
						preset: t(`preset_${preset ?? 'custom'}`)
					}),
					t('judgedBy', { model: data.model })
				]
					.filter((part) => part != null)
					.join('  ·  ')}
			</Text>

			<View style={styles.verdict}>
				<Verdict data={data} text={text} />
			</View>
			{incomplete > 0 && (
				<Text style={styles.banner}>{t('incompleteBanner', { count: incomplete })}</Text>
			)}

			<Text style={styles.h2}>{t('scorecardTitle')}</Text>
			<Scorecard vendors={data.report.vendors} text={text} />
			<View style={[styles.small, styles.muted, { marginTop: 6 }]}>
				<Text>{t('precisionMeaning')}</Text>
				<Text>{t('recallMeaning')}</Text>
				<Text>{t('f1Meaning')}</Text>
			</View>
			<Text style={styles.caveat}>{t('caveat')}</Text>
			<Footer data={data} text={text} />
		</Page>
	)
}

function ErrorReading({ vendor, text }: { vendor: VendorDetail; text: Props['text'] }) {
	const { t } = text
	const roles = (items: string[]) => text.list(items.map((role) => text.role(role)))
	const pattern = (fields: VendorDetail['merges']) =>
		fields == null
			? null
			: fields.different.length > 0
				? t('patternSharedDiffer', {
						shared: roles(fields.shared),
						different: roles(fields.different)
					})
				: t('patternShared', { shared: roles(fields.shared) })
	const merges = vendor.metrics.fp > 0 ? pattern(vendor.merges) : null
	const misses = vendor.metrics.fn > 0 ? pattern(vendor.misses) : null
	return (
		<View wrap={false}>
			<Text style={styles.h3}>{vendor.name}</Text>
			<Text style={styles.paragraph}>
				{t('mergesCount', { count: vendor.metrics.fp })}
				{merges == null ? '' : ` ${merges}`}
			</Text>
			<Text style={styles.paragraph}>
				{t('missesCount', { count: vendor.metrics.fn })}
				{misses == null ? '' : ` ${misses}`}
			</Text>
		</View>
	)
}

function TradeoffsPage({ data, text }: Props) {
	const { t } = text
	const { vendors, headToHead } = data.report
	const name = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? ''
	const hasCurve = vendors.some((vendor) => vendor.sensitivity.some((point) => point.f1 != null))
	return (
		<Page size="A4" style={styles.page}>
			<Text style={[styles.h2, { marginTop: 0 }]}>{t('errorsTitle')}</Text>
			<Text style={[styles.paragraph, styles.muted]}>{t('errorsIntro')}</Text>
			{vendors.map((vendor) => (
				<ErrorReading key={vendor.id} vendor={vendor} text={text} />
			))}

			{hasCurve && (
				<>
					<Text style={styles.h2}>{t('sensitivityTitle')}</Text>
					<Text style={[styles.paragraph, styles.muted]}>{t('sensitivityIntro')}</Text>
					<SensitivityChart vendors={vendors} threshold={data.threshold} text={text} />
				</>
			)}

			{headToHead.length > 0 && (
				<>
					<Text style={styles.h2}>{t('headToHeadTitle')}</Text>
					<Text style={[styles.paragraph, styles.muted]}>{t('headToHeadIntro')}</Text>
					{headToHead.map((match) => (
						<Text key={`${match.a}-${match.b}`} style={styles.paragraph}>
							{match.total === 0
								? t('headToHeadNone', { a: name(match.a), b: name(match.b) })
								: match.sidedWithA === match.sidedWithB
									? t('headToHeadTie', {
											a: name(match.a),
											b: name(match.b),
											wins: match.sidedWithA,
											total: match.total
										})
									: t('headToHead', {
											a: name(match.a),
											b: name(match.b),
											winner: name(match.sidedWithA > match.sidedWithB ? match.a : match.b),
											wins: Math.max(match.sidedWithA, match.sidedWithB),
											total: match.total
										})}
						</Text>
					))}
				</>
			)}

			<Footer data={data} text={text} />
		</Page>
	)
}

// Every heading and card is a direct child of the page: react-pdf squashes
// unbreakable blocks that sit inside other views when they meet a page break.
function ExamplesPage({ data, text }: Props) {
	const { t } = text
	const sections = data.report.vendors.flatMap((vendor) =>
		(
			[
				['examplesMerges', vendor.examples.merges],
				['examplesMisses', vendor.examples.misses]
			] as const
		).map(([title, examples]) => ({
			key: `${vendor.id}-${title}`,
			heading: t(title, { vendor: vendor.name }),
			examples
		}))
	)
	return (
		<Page size="A4" style={styles.page}>
			<Text style={[styles.h2, { marginTop: 0 }]}>{t('examplesTitle')}</Text>
			<Text style={[styles.paragraph, styles.muted]}>{t('examplesIntro')}</Text>
			{sections.flatMap(({ key, heading, examples }) =>
				examples.length === 0
					? [
							<View key={key} wrap={false}>
								<Text style={styles.h3}>{heading}</Text>
								<Text style={[styles.paragraph, styles.muted]}>{t('examplesNone')}</Text>
							</View>
						]
					: examples.map((example, index) => (
							<ExampleCard
								key={`${key}-${example.recordA.id}-${example.recordB.id}`}
								example={example}
								heading={index === 0 ? heading : undefined}
								text={text}
							/>
						))
			)}
			<Footer data={data} text={text} />
		</Page>
	)
}

function MethodPage({ data, text }: Props) {
	const { t } = text
	const { pairs, suggested } = data.report
	const fresh = Math.max(0, data.progress.succeeded - data.reused)
	return (
		<Page size="A4" style={styles.page}>
			<Text style={[styles.h2, { marginTop: 0 }]}>{t('methodTitle')}</Text>

			<Text style={styles.h3}>{t('dataTitle')}</Text>
			<KeyValue label={t('recordsLabel')}>
				{t('recordsLine', {
					file: data.dataset.fileName,
					count: data.dataset.rowCount,
					column: data.dataset.referenceColumn
				})}
			</KeyValue>
			{data.vendorFiles.map((vendor) => (
				<KeyValue key={vendor.id} label={vendor.name}>
					{t('vendorLine', {
						file: vendor.fileName,
						format: vendor.format,
						pairs: vendor.pairCount,
						date: text.date(vendor.confirmedCompleteAt)
					})}
				</KeyValue>
			))}
			<KeyValue label={t('fieldsLabel')}>
				{text.list(data.jevFields.map((field) => text.role(field)))}
			</KeyValue>

			<Text style={styles.h3}>{t('identityTitle')}</Text>
			<KeyValue label={t('sameLabel')}>{data.identitySame}</KeyValue>
			<KeyValue label={t('differentLabel')}>{data.identityDifferent}</KeyValue>
			<KeyValue label={t('countryLabel')}>{data.countryCode}</KeyValue>

			<Text style={styles.h3}>{t('rulesTitle')}</Text>
			<Text style={[styles.paragraph, styles.muted]}>{t('rulesIntro')}</Text>

			<Text style={styles.h3}>{t('coverageTitle')}</Text>
			<Text style={styles.paragraph}>
				{t('coverageLine', {
					total: pairs.total,
					suggested,
					addedByVendor: pairs.total - suggested
				})}
			</Text>
			<Text style={styles.paragraph}>
				{t('coverageStatus', {
					assessed: pairs.assessed,
					failed: pairs.failed,
					pending: pairs.pending
				})}
			</Text>
			{data.progress.failures.map((failure) => (
				<Text key={failure.reason} style={[styles.paragraph, styles.muted]}>
					{t('failureLine', { reason: text.failure(failure.reason), count: failure.count })}
				</Text>
			))}
			{data.notCompared > 0 && (
				<Text style={[styles.paragraph, styles.muted]}>
					{t('notCompared', { count: data.notCompared })}
				</Text>
			)}
			{data.suggestedType != null && (
				<Text style={[styles.paragraph, styles.muted]}>
					{t('notComparedSuggested', { type: data.suggestedType })}
				</Text>
			)}

			<Text style={styles.h3}>{t('judgmentsTitle')}</Text>
			<KeyValue label={t('modelLabel')}>{data.model}</KeyValue>
			<KeyValue label={t('timesLabel')}>
				{data.completedAt == null
					? t('runNotFinished', { started: text.dateTime(data.createdAt) })
					: t('runTimes', {
							started: text.dateTime(data.createdAt),
							finished: text.dateTime(data.completedAt)
						})}
			</KeyValue>
			<KeyValue label={t('scoresLabel')}>{t('reused', { reused: data.reused, fresh })}</KeyValue>
			<KeyValue label={t('humanReviewLabel')}>{t('humanReview')}</KeyValue>

			<Text style={styles.h3}>{t('glossaryTitle')}</Text>
			{['glossaryBoth', 'glossaryMerge', 'glossaryMiss', 'glossaryNeither', 'glossaryAi'].map(
				(key) => (
					<Text key={key} style={[styles.paragraph, styles.small]}>
						{t(key)}
					</Text>
				)
			)}
			<Footer data={data} text={text} />
		</Page>
	)
}

export function ReportDocument(props: Props) {
	const { data, text } = props
	return (
		<Document
			title={text.t('documentTitle', { evaluation: data.evaluationName, number: data.runNumber })}
			author="PairSight"
			creator="PairSight"
			producer="PairSight"
		>
			<SummaryPage {...props} />
			<TradeoffsPage {...props} />
			<ExamplesPage {...props} />
			<MethodPage {...props} />
		</Document>
	)
}
