'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDownIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// Your own comparison rules, out of the way: PairSight suggests the pairs by
// default, so most people never need these. Open from the start when rules
// are on, or when suggestions aren't picking pairs. Kept mounted while
// closed, so nothing being edited inside is lost.
export function AdvancedRules({
	rulesOn,
	isOpenAtFirst,
	children
}: {
	rulesOn: number
	isOpenAtFirst: boolean
	children: React.ReactNode
}) {
	const t = useTranslations('Rules')
	const [isOpen, setIsOpen] = useState(isOpenAtFirst)
	return (
		<section aria-labelledby="advanced-title" className="space-y-4">
			<h2 id="advanced-title" className="text-base font-semibold">
				<button
					type="button"
					aria-expanded={isOpen}
					aria-controls="advanced-rules"
					onClick={() => setIsOpen((current) => !current)}
					className="border-border bg-surface flex w-full items-center justify-between gap-3 rounded-md border px-5 py-3 text-left"
				>
					<span className="flex items-center gap-2">
						<ChevronDownIcon
							size={16}
							className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
						/>
						{t('advancedTitle')}
					</span>
					<span className="type-ui text-text-muted font-normal">
						{rulesOn > 0 ? t('advancedOn', { count: rulesOn }) : t('advancedNone')}
					</span>
				</button>
			</h2>
			<div id="advanced-rules" hidden={!isOpen}>
				{children}
			</div>
		</section>
	)
}
