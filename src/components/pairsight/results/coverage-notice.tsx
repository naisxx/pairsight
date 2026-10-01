import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { AlertIcon, InfoIcon } from '@/components/ui/icons'

// What the comparison set covers, and what blocking left unevaluated, plus a
// banner when some pairs aren't judged yet or failed.
export function CoverageNotice({
	runHref,
	coverage,
	incomplete
}: {
	runHref: string
	coverage: { total: number; fromRules: number; addedByVendor: number }
	incomplete: number
}) {
	const t = useTranslations('Results')
	const format = useFormatter()
	return (
		<>
			<p className="text-text-muted type-body mt-4 flex items-start gap-2">
				<InfoIcon className="mt-0.5 shrink-0" />
				{t('coverage', {
					total: coverage.total,
					fromRules: format.number(coverage.fromRules),
					addedByVendor: format.number(coverage.addedByVendor)
				})}
			</p>
			{incomplete > 0 && (
				<p className="bg-warning-subtle text-warning type-body mt-4 flex flex-wrap items-center gap-2 rounded px-3 py-2">
					<AlertIcon />
					{t('incompleteBanner', { count: incomplete })}
					<Link href={runHref} className="font-medium underline underline-offset-4">
						{t('openRun')}
					</Link>
				</p>
			)}
		</>
	)
}
