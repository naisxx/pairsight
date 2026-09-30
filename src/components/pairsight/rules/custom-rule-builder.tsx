'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PlusIcon, SpinnerIcon } from '@/components/ui/icons'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import {
	customRule,
	hasSameFields,
	MAX_CUSTOM_RULES,
	MAX_RULE_FIELDS
} from '@/lib/pairsight/custom-rules'
import { COUNTRY_CODE_PATTERN } from '@/lib/pairsight/input-limits'
import { previewRuleAction } from '@/server/actions/pairsight/rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { BlockingField } from '@/server/pairsight/normalize'
import { RuleStatsLine, type RuleLimits } from './blocking-rule-card'

const NONE = 'none'

type Rule = { id: string; fields: BlockingField[] }

// "Advanced": a custom rule of 1–3 fields that must all match. Its stats are
// computed on the server as the fields change, so the user sees what it
// would add before adding it.
export function CustomRuleBuilder({
	evaluationId,
	country,
	availableFields,
	rules,
	customCount,
	limits,
	onAdd
}: {
	evaluationId: string
	country: string
	availableFields: readonly BlockingField[]
	rules: readonly Rule[]
	customCount: number
	limits: RuleLimits
	onAdd: (rule: Rule, stat: RuleStats) => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const [slots, setSlots] = useState<Array<BlockingField | null>>(() =>
		Array.from({ length: MAX_RULE_FIELDS }, () => null)
	)
	const chosen = [...new Set(slots.filter((field) => field != null))]
	const rule = customRule(chosen)
	const duplicate =
		chosen.length > 0 ? rules.find((existing) => hasSameFields(existing.fields, chosen)) : undefined
	const isFull = customCount >= MAX_CUSTOM_RULES
	const canPreview = chosen.length > 0 && duplicate == null && COUNTRY_CODE_PATTERN.test(country)

	const preview = useQuery({
		queryKey: ['pairsight', 'rule-preview', evaluationId, country.toUpperCase(), rule.id],
		queryFn: async () => {
			const result = await previewRuleAction({
				evaluationId,
				fields: rule.fields,
				countryCode: country
			})
			if (!result.ok) throw new Error(result.error)
			return result.data
		},
		enabled: canPreview
	})

	function setSlot(index: number, value: string) {
		const field = availableFields.find((candidate) => candidate === value) ?? null
		setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? field : slot)))
	}

	function add() {
		if (preview.data == null) return
		onAdd(rule, preview.data)
		setSlots((current) => current.map(() => null))
	}

	return (
		<details className="border-border rounded-lg border p-4">
			<summary className="text-text cursor-pointer text-sm font-semibold">
				{t('customTitle')}
			</summary>
			<div className="mt-3 flex flex-col gap-3">
				<p className="text-text-muted text-xs">{t('customDescription')}</p>
				<div className="grid gap-2 sm:grid-cols-3">
					{slots.map((slot, index) => (
						<Select
							key={index}
							value={slot ?? NONE}
							onValueChange={(value) => setSlot(index, value)}
						>
							<SelectTrigger
								size="sm"
								className="w-full"
								aria-label={t('customField', { number: index + 1 })}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('customNone')}</SelectItem>
								{availableFields.map((field) => (
									<SelectItem key={field} value={field}>
										{tRoles(field)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					))}
				</div>
				{duplicate != null ? (
					<p className="text-text-muted text-xs">{t('customDuplicate')}</p>
				) : preview.isFetching ? (
					<p className="text-text-muted flex items-center gap-1.5 text-xs">
						<SpinnerIcon size={12} />
						{t('customCounting')}
					</p>
				) : preview.isError ? (
					<p role="alert" className="text-danger text-xs">
						{preview.error.message}
					</p>
				) : preview.data != null ? (
					<RuleStatsLine stat={preview.data} limits={limits} />
				) : null}
				<div className="flex items-center justify-end gap-3">
					{isFull && (
						<p className="text-text-muted mr-auto text-xs">
							{t('customLimit', { max: MAX_CUSTOM_RULES })}
						</p>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={add}
						disabled={!canPreview || isFull || preview.data == null || preview.isFetching}
					>
						<PlusIcon />
						{t('customAdd')}
					</Button>
				</div>
			</div>
		</details>
	)
}
