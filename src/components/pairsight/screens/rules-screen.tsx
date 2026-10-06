import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ruleLabel } from '@/components/pairsight/rule-label'
import { RulesForm } from '@/components/pairsight/rules/rules-form'
import { StepHeader } from '@/components/pairsight/step-layout'
import { countryOptions } from '@/server/pairsight/countries'
import { LIMITS } from '@/server/pairsight/limits'
import { computePlan } from '@/server/pairsight/plan'
import { rulesPreview } from '@/server/pairsight/rules-preview'
import { parseIdentityRoles } from '@/server/pairsight/schemas'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'
import { RefreshWhile } from '@/components/pairsight/refresh-while'

export async function RulesScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view, scope } = loaded
	const id = view.evaluationId
	const [t, tRoles, locale] = await Promise.all([
		getTranslations('Rules'),
		getTranslations('Roles'),
		getLocale()
	])
	// Unreachable: without records the stage is locked and loadWorkspace redirects.
	if (workspace.dataset == null) notFound()
	const [preview, plan] = await Promise.all([
		rulesPreview({ scope, evaluationId: id }),
		computePlan({ scope, evaluationId: id })
	])
	const { evaluation } = preview
	// The summary follows what's saved: the plan's counts and the saved rules.
	const savedStats = ('ruleStats' in plan ? plan.ruleStats : undefined) ?? []
	const counts = 'counts' in plan ? plan.counts : null
	const splink = ('splink' in plan ? plan.splink : undefined) ?? null
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
					enabledRuleIds: preview.saved.map((rule) => rule.id),
					threshold: evaluation.threshold,
					splinkPicks: evaluation.splinkPicks
				}}
				rules={preview.rules}
				mappedRoles={preview.mappedRoles}
				stats={preview.stats}
				summary={{
					fromRules: (counts?.blockedPairs ?? 0) - (counts?.addedBySplinkOnly ?? 0),
					suggestedOnly: counts?.addedBySplinkOnly ?? 0,
					vendorOnly: counts?.addedByVendorOnly ?? 0,
					total: counts?.uniquePairs ?? 0,
					isExact: counts?.isExact ?? true,
					limit: LIMITS.maxPairsPerRun,
					raw: savedStats.reduce((sum, stat) => sum + stat.pairCount, 0),
					largest: Math.max(0, ...savedStats.map((stat) => stat.largestBucket)),
					oversized: savedStats.flatMap((stat) =>
						stat.largestBucket <= LIMITS.bucketWarningSize
							? []
							: [
									{
										rule: ruleLabel({
											ruleId: stat.ruleId,
											rules: plan.rules,
											tRules: t,
											tRoles
										}),
										size: stat.largestBucket
									}
								]
					)
				}}
				suggestions={{
					state: splink?.state ?? 'off',
					suggested: splink?.suggested ?? 0,
					reasons: splink?.reasons ?? [],
					vendorCheck: ('vendorCheck' in plan ? plan.vendorCheck : undefined) ?? []
				}}
				countries={countryOptions(locale)}
				limits={{
					bucketWarningSize: LIMITS.bucketWarningSize,
					maxPairsPerRun: LIMITS.maxPairsPerRun
				}}
			/>
		</>
	)
}
