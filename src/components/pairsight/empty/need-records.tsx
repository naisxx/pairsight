import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, CsvFileIcon } from '@/components/ui/icons'
import { EmptyState } from './empty-state'

// Steps that work on the source records (Vendors, Rules) before any exist.
export async function NeedRecords({ evaluationId }: { evaluationId: string }) {
	const t = await getTranslations('Empty')
	return (
		<div className="border-border bg-surface rounded-lg border">
			<EmptyState
				icon={CsvFileIcon}
				title={t('needRecordsTitle')}
				description={t('needRecordsDescription')}
				actions={
					<Button asChild>
						<Link href={`/evaluations/${evaluationId}/records`}>
							{t('goToRecords')}
							<ArrowRightIcon />
						</Link>
					</Button>
				}
			/>
		</div>
	)
}
