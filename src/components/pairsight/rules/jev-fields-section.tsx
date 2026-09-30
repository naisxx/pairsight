'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import type { IdentityRole } from '@/server/pairsight/fields'
import { Section } from '../step-layout'

// Which mapped fields Jev compares. Only these (plus the identity definition
// and country) are ever sent.
export function JevFieldsSection({
	mappedRoles,
	selected,
	onToggle
}: {
	mappedRoles: IdentityRole[]
	selected: ReadonlySet<IdentityRole>
	onToggle: (role: IdentityRole, isOn: boolean) => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	return (
		<Section title={t('jevFieldsTitle')} description={t('jevFieldsDescription')}>
			<div className="flex flex-wrap gap-x-6 gap-y-3">
				{mappedRoles.map((role) => (
					<label key={role} className="text-text flex items-center gap-2 text-sm">
						<Checkbox
							checked={selected.has(role)}
							onCheckedChange={(checked) => onToggle(role, checked === true)}
						/>
						{tRoles(role)}
					</label>
				))}
			</div>
		</Section>
	)
}
