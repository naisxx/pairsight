import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { ArrowRightIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import type { Workload } from '@/lib/pairsight/metrics'

// What's left to look at for this vendor, each opening its pairs: the
// disagreements, the scores closest to the threshold, and what isn't judged.
export function WorkloadPanel({
	vendorName,
	workload,
	hrefs,
	className
}: {
	vendorName: string
	workload: Workload
	hrefs: { disagreements: string; near: string; incomplete: string }
	className?: string
}) {
	const t = useTranslations('Overview')
	const rows = [
		{
			key: 'disagreements',
			value: workload.disagreements,
			label: t('workloadDisagreements'),
			detail: t('workloadDisagreementsDetail', {
				pairsight: workload.pairsightOnly,
				vendor: workload.vendorOnly
			}),
			href: hrefs.disagreements
		},
		{
			key: 'near',
			value: workload.nearThreshold,
			label: t('workloadNear'),
			detail: t('workloadNearDetail'),
			href: hrefs.near
		},
		{
			key: 'incomplete',
			value: workload.incomplete,
			label: t('workloadIncomplete'),
			detail: t('workloadIncompleteDetail'),
			href: hrefs.incomplete
		}
	]

	return (
		<Panel
			id="workload"
			title={t('workloadTitle')}
			description={t('workloadFor', { vendor: vendorName })}
			className={className}
		>
			<ul className="-mx-2">
				{rows.map((row) => (
					<li key={row.key}>
						<Link
							href={row.href}
							className="group hover:bg-surface-hover flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors duration-150"
						>
							<span className="w-8 font-mono text-lg font-medium">{row.value}</span>
							<span className="min-w-0 flex-1">
								<span className="text-text type-ui block font-medium">{row.label}</span>
								<span className="text-text-muted block truncate text-xs">{row.detail}</span>
							</span>
							<ArrowRightIcon
								size={14}
								className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
							/>
						</Link>
					</li>
				))}
			</ul>
		</Panel>
	)
}
