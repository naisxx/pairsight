import { getTranslations } from 'next-intl/server'
import { ErrorPage } from '@/components/error-page'
import { EvaluationLayout } from '@/components/pairsight/screens/evaluation-layout'
import { SandboxBanner } from '@/components/pairsight/shell/sandbox-banner'
import { SANDBOX_BASE } from '@/lib/pairsight/sandbox'
import {
	getSandboxRecording,
	loadWorkspace,
	SANDBOX_TARGET
} from '@/server/pairsight/evaluation-pages'

// The public sandbox (docs/PairSight-UX-Plan.md, "What shipped"): the whole
// app, read-only, on one prepared evaluation. No sign-in needed; signed in,
// the account shows as usual. Until `pnpm demo:seed` has run, it says so.
export default async function SandboxLayout({ children }: { children: React.ReactNode }) {
	const [recording, t, tShell] = await Promise.all([
		getSandboxRecording(),
		getTranslations('Sandbox'),
		getTranslations('Shell')
	])
	if (recording == null) {
		return <ErrorPage title={t('missingTitle')} description={t('missingDescription')} />
	}
	const loaded = await loadWorkspace(SANDBOX_TARGET)
	return (
		<EvaluationLayout
			loaded={loaded}
			home={{ href: SANDBOX_BASE, label: tShell('sandbox') }}
			banner={<SandboxBanner recording={recording} isSignedIn={loaded.viewer != null} />}
		>
			{children}
		</EvaluationLayout>
	)
}
