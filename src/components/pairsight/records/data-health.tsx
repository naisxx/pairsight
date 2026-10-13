import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { InfoTip } from '@/components/ui/info-tip'
import { Glyph } from '../glyph'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { fillRates, healthFindings, type HealthFinding } from '@/server/pairsight/profile/findings'
import type { DatasetProfile } from '@/server/pairsight/profile/profile'

// What PairSight noticed in the saved file (profile/findings.ts): stand-ins
// for "not known", values too many records share, how dates are written,
// values it couldn't read. Each changes only how pairs are picked; the line
// under the title says so, since Jev and every screen keep the file as is.
export async function DataHealth({
	profile,
	type,
	isReadOnly
}: {
	profile: DatasetProfile
	type: EntityType
	// The demo: nothing to change, so no advice to change it.
	isReadOnly: boolean
}) {
	const t = await getTranslations('Records')
	const tRoles = await getTranslations('Roles')
	const format = await getFormatter()
	const regions = new Intl.DisplayNames([await getLocale()], { type: 'region' })
	// Where the records are from decides how numbers and dates read; it's
	// changed in What Jev checks, except in the read-only demo.
	const changeCountry = isReadOnly ? null : <> {t('healthChangeCountry')}</>
	const findings = healthFindings(profile, type)
	const rates = fillRates(profile, type)
	const strong = (chunks: React.ReactNode) => <span className="font-medium">{chunks}</span>
	const mono = (chunks: React.ReactNode) => <span className="font-mono">{chunks}</span>
	const quoted = (values: string[]) => format.list(values.map((value) => `‘${value}’`))

	const line = (finding: HealthFinding) => {
		switch (finding.kind) {
			case 'filler':
				return t.rich('healthFiller', {
					field: tRoles(finding.role),
					values:
						finding.more > 0
							? t('healthFillerMore', { values: quoted(finding.values), more: finding.more })
							: quoted(finding.values),
					count: finding.count,
					kinds: finding.values.length + finding.more,
					b: strong
				})
			case 'overused':
				return t.rich('healthOverused', {
					field: tRoles(finding.role),
					value: finding.value,
					count: finding.count,
					b: strong,
					m: mono
				})
			case 'dates':
				return (
					<>
						{t.rich(finding.assumed ? 'healthDatesAssumed' : 'healthDates', {
							field: tRoles('date_of_birth'),
							order: finding.order,
							b: strong,
							m: mono
						})}
						{finding.assumed && changeCountry}
					</>
				)
			case 'country':
				return (
					<>
						{t.rich('healthCountry', {
							country: regions.of(finding.code) ?? finding.code,
							from: format.list(finding.from.map((signal) => t(`healthCountryFrom.${signal}`))),
							b: strong
						})}
						{changeCountry}
					</>
				)
			case 'unreadable':
				return t.rich('healthUnreadable', {
					field: tRoles(finding.role),
					count: finding.count,
					b: strong
				})
		}
	}

	return (
		<section
			aria-labelledby="health-title"
			className="border-border bg-surface rounded-lg border p-6 md:p-7"
		>
			<header className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<h2 id="health-title" className="text-text-muted type-eyebrow">
						{t('healthTitle')}
					</h2>
					<p className="text-text-muted mt-2 text-sm">{t('healthDescription')}</p>
				</div>
				{rates.length > 0 && (
					<InfoTip
						label={t('healthFillLabel')}
						content={
							<div className="space-y-1">
								<p className="font-medium">{t('healthFillTitle')}</p>
								<ul className="space-y-0.5">
									{rates.map(({ role, share }) => (
										<li key={role} className="flex justify-between gap-4">
											<span>{tRoles(role)}</span>
											<span className="font-mono">
												{format.number(share, { style: 'percent', maximumFractionDigits: 0 })}
											</span>
										</li>
									))}
								</ul>
							</div>
						}
					/>
				)}
			</header>
			{findings.length === 0 ? (
				<p className="border-border mt-3.5 flex items-start gap-3 border-t pt-3 text-base">
					<Glyph kind="check" className="size-6 text-[0.8125rem]" />
					{t('healthNone')}
				</p>
			) : (
				<ul className="divide-border border-border mt-3.5 max-h-64 divide-y overflow-y-auto border-t">
					{findings.map((finding) => (
						<li
							key={`${finding.kind}-${'role' in finding ? finding.role : ''}-${'value' in finding ? finding.value : ''}`}
							className="flex items-start gap-3 py-3 text-base"
						>
							<Glyph
								kind={finding.kind === 'country' ? 'check' : 'missing'}
								className="size-6 text-[0.8125rem]"
							/>
							<p>{line(finding)}</p>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
