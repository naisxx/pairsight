import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPage } from '@/components/pairsight/legal-page'

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

export default async function PrivacyPage() {
	const t = await getTranslations('Legal')
	return (
		<LegalPage
			title={t('privacyTitle')}
			intro={t('privacyIntro')}
			updated={t('updated', { date: '11 October 2026' })}
			sections={SECTIONS.map((key) => ({ title: t(`${key}Title`), body: t(`${key}Body`) }))}
		/>
	)
}
