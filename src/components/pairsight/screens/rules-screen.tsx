import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RulesForm } from '@/components/pairsight/rules/rules-form'
import { StepHeader } from '@/components/pairsight/step-layout'
import { countryOptions } from '@/server/pairsight/countries'
import { mappedIdentityRoles } from '@/server/pairsight/fields'
import { parseColumnRoles } from '@/server/pairsight/json'
import { computePlan } from '@/server/pairsight/plan'
import { parseIdentityRoles } from '@/server/pairsight/schemas'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'
import { RefreshWhile } from '@/components/pairsight/refresh-while'

export async function RulesScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view, scope } = loaded
	const id = view.evaluationId
	const [t, locale] = await Promise.all([getTranslations('Rules'), getLocale()])
	// Unreachable: without records the stage is locked and loadWorkspace redirects.
	if (workspace.dataset == null) notFound()
	const plan = await computePlan({ scope, evaluationId: id })
	const { evaluation } = plan
	const splink = 'splink' in plan ? plan.splink : null
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			{/* Suggestions still being worked out: the card fills in by itself. */}
			<RefreshWhile isActive={splink?.state === 'waiting'} />
			<RulesForm
				evaluationId={id}
				initial={{
					identitySame: evaluation.identitySame,
					identityDifferent: evaluation.identityDifferent,
					countryCode: evaluation.countryCode,
					jevFields: parseIdentityRoles(evaluation.jevFields),
					threshold: evaluation.threshold
				}}
				mappedRoles={[...mappedIdentityRoles(parseColumnRoles(workspace.dataset.columnRoles))]}
				suggestions={{
					state: splink?.state ?? 'waiting',
					entityType: entityTypeOf(evaluation.entityType),
					suggested: splink?.suggested ?? 0,
					reasons: splink?.reasons ?? [],
					vendorCheck: ('vendorCheck' in plan ? plan.vendorCheck : undefined) ?? []
				}}
				countries={countryOptions(locale)}
			/>
		</>
	)
}
