import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPage } from '@/components/pairsight/legal-page'
import { isOnPrem } from '@/server/deployment'

// TODO(legal review): plain, factual wording of what PairSight does today;
// whoever owns legal reviews it before launch, and adds the company's legal
// name and a contact (pairsight-handoff Landing: [COMPANY LEGAL NAME]).
const SECTIONS = [
	'privacyKeep',
	'privacySee',
	'privacyJev',
	'privacyDelete',
	'privacyUsage',
	'privacyCookies'
] as const

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('Legal')
	return { title: t('privacyTitle') }
}

// On a customer's own machine (docs/PairSight-OnPrem.md) it says so first,
// and nothing counts usage or reports errors to us, so those two say that.
const ON_PREM_BODIES: Partial<Record<(typeof SECTIONS)[number], string>> = {
	privacyUsage: 'privacyUsageOnPremBody',
	privacyCookies: 'privacyCookiesOnPremBody'
}

export default async function PrivacyPage() {
	const t = await getTranslations('Legal')
	const onPrem = isOnPrem()
	const sections = SECTIONS.map((key) => ({
		title: t(`${key}Title`),
		body: t((onPrem ? ON_PREM_BODIES[key] : undefined) ?? `${key}Body`)
	}))
	return (
		<LegalPage
			title={t('privacyTitle')}
			intro={t('privacyIntro')}
			updated={t('updated', { date: '11 October 2026' })}
			sections={
				onPrem
					? [{ title: t('privacyOnPremTitle'), body: t('privacyOnPremBody') }, ...sections]
					: sections
			}
		/>
	)
}
