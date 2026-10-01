import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { RulesForm } from '@/components/pairsight/rules/rules-form'
import { StepHeader } from '@/components/pairsight/step-layout'
import { parseIdentityRoles } from '@/server/pairsight/schemas'
import { LIMITS } from '@/server/pairsight/limits'
import { rulesPreview } from '@/server/pairsight/rules-preview'
import { loadWorkspace } from '../workspace'

export default async function RulesPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ user, workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/rules`),
		getTranslations('Rules')
	])
	if (workspace.dataset == null) {
		return (
			<>
				<StepHeader title={t('title')} description={t('description')} />
				<Link
					href={`/evaluations/${id}/records`}
					className="text-accent-ink type-label self-start hover:underline"
				>
					{t('needRecords')}
				</Link>
			</>
		)
	}
	const preview = await rulesPreview({ ownerId: user.id, evaluationId: id })
	const { evaluation } = preview
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			<RulesForm
				evaluationId={id}
				initial={{
					identitySame: evaluation.identitySame,
					identityDifferent: evaluation.identityDifferent,
					countryCode: evaluation.countryCode,
					jevFields: parseIdentityRoles(evaluation.jevFields),
					enabledRuleIds: preview.saved.map((rule) => rule.id)
				}}
				rules={preview.rules}
				mappedRoles={preview.mappedRoles}
				stats={preview.stats}
				limits={{
					bucketWarningSize: LIMITS.bucketWarningSize,
					maxPairsPerRun: LIMITS.maxPairsPerRun
				}}
			/>
		</>
	)
}
