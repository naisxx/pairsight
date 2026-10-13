import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPage } from '@/components/pairsight/legal-page'

// TODO(legal review): plain, factual wording of what PairSight does today;
// whoever owns legal reviews it before launch, and adds the company's legal
// name and a contact (pairsight-handoff Landing: [COMPANY LEGAL NAME]).
const SECTIONS = [
	'termsWhat',
	'termsNotCertificate',
	'termsRecords',
	'termsCost',
	'termsDemo'
] as const

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('Legal')
	return { title: t('termsTitle') }
}

export default async function TermsPage() {
	const t = await getTranslations('Legal')
	return (
		<LegalPage
			title={t('termsTitle')}
			intro={t('termsIntro')}
			updated={t('updated', { date: '11 October 2026' })}
			sections={SECTIONS.map((key) => ({ title: t(`${key}Title`), body: t(`${key}Body`) }))}
		/>
	)
}
