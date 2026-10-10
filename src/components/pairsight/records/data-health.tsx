import { getFormatter, getTranslations } from 'next-intl/server'
import { InfoTip } from '@/components/ui/info-tip'
import { InfoIcon, SuccessIcon } from '@/components/ui/icons'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { fillRates, healthFindings, type HealthFinding } from '@/server/pairsight/profile/findings'
import type { DatasetProfile } from '@/server/pairsight/profile/profile'

const ICON_SIZE = 15

// What PairSight noticed in the saved file (profile/findings.ts): stand-ins
// for "not known", values too many records share, how dates are written,
// values it couldn't read. Each changes only how pairs are picked; the line
// under the title says so, since Jev and every screen keep the file as is.
export async function DataHealth({ profile, type }: { profile: DatasetProfile; type: EntityType }) {
	const t = await getTranslations('Records')
	const tRoles = await getTranslations('Roles')
	const format = await getFormatter()
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
				return t.rich(finding.assumed ? 'healthDatesAssumed' : 'healthDates', {
					field: tRoles('date_of_birth'),
					order: finding.order,
					b: strong,
					m: mono
				})
			case 'unreadable':
				return t.rich('healthUnreadable', {
					field: tRoles(finding.role),
					count: finding.count,
					b: strong
				})
		}
	}

	return (
		<section aria-labelledby="health-title" className="border-border bg-surface rounded-lg border">
			<header className="flex items-start gap-2 px-4 pt-3">
				<div className="min-w-0 flex-1">
					<h2 id="health-title" className="text-sm font-semibold">
						{t('healthTitle')}
					</h2>
					<p className="text-text-muted mt-0.5 text-xs">{t('healthDescription')}</p>
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
				<p className="type-ui text-success flex gap-2 px-4 pt-2 pb-3">
					<SuccessIcon size={ICON_SIZE} variant="solid" className="mt-0.5 shrink-0" />
					{t('healthNone')}
				</p>
			) : (
				<ul className="divide-border mt-2 max-h-64 divide-y overflow-y-auto">
					{findings.map((finding) => (
						<li
							key={`${finding.kind}-${'role' in finding ? finding.role : ''}-${'value' in finding ? finding.value : ''}`}
							className="type-ui flex gap-2 px-4 py-2.5"
						>
							<InfoIcon size={ICON_SIZE} className="text-text-muted mt-0.5 shrink-0" />
							<p>{line(finding)}</p>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
