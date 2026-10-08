'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { OrganisationIcon, ProductIcon, UserIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { ENTITY_TYPES, type EntityType } from '@/lib/pairsight/entity-types'

const ICON_SIZE = 18
const ICONS = { person: UserIcon, company: OrganisationIcon, product: ProductIcon } as const

// What the records describe, read from the file and confirmed here. A
// confident guess says so; an unsure one asks. Changing it suggests that
// type's fields instead.
export function EntityTypePicker({
	value,
	detected,
	confident,
	onChange,
	disabled
}: {
	value: EntityType
	detected: EntityType
	confident: boolean
	onChange: (type: EntityType) => void
	disabled?: boolean
}) {
	const t = useTranslations('EntityTypes')
	const titleId = useId()
	return (
		<section aria-labelledby={titleId} className="border-border bg-surface rounded-lg border p-4">
			<p id={titleId} className="text-sm font-semibold">
				{confident ? t('detected', { type: detected }) : t('ask')}
			</p>
			<p className="text-text-muted type-ui mt-0.5">{t('explain')}</p>
			<div
				role="radiogroup"
				aria-labelledby={titleId}
				className="mt-3 grid grid-cols-1 gap-2 @3xl:grid-cols-3"
			>
				{ENTITY_TYPES.map((type) => {
					const Icon = ICONS[type]
					const isSelected = value === type
					return (
						<button
							key={type}
							type="button"
							role="radio"
							aria-checked={isSelected}
							disabled={disabled}
							onClick={() => {
								if (!isSelected) onChange(type)
							}}
							className={cn(
								'type-ui flex items-start gap-3 rounded-sm border p-3 text-left transition-[background-color,border-color] duration-150 disabled:cursor-default',
								isSelected
									? 'border-action bg-surface-hover'
									: 'border-border hover:bg-surface-hover'
							)}
						>
							<Icon size={ICON_SIZE} className="text-text-muted mt-0.5 shrink-0" />
							<span>
								<span className="block font-medium">
									{t('name', { type })}
									{type === detected && confident && (
										<span className="text-text-muted ml-1.5 text-xs font-normal">
											{t('detectedBadge')}
										</span>
									)}
								</span>
								<span className="text-text-muted block text-xs">{t('examples', { type })}</span>
							</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
