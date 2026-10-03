import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { EvaluationLayout } from '@/components/pairsight/screens/evaluation-layout'
import { SandboxBanner } from '@/components/pairsight/shell/sandbox-banner'
import { SANDBOX_BASE } from '@/lib/pairsight/sandbox'
import {
	getSandboxRecording,
	loadWorkspace,
	sandboxTarget
} from '@/server/pairsight/evaluation-pages'
import { isUuid } from '@/server/pairsight/schemas'

// One of the sandbox's prepared evaluations (docs/PairSight-UX-Plan.md, "What
// shipped"): the whole app, read-only. No sign-in needed; signed in, the
// account shows as usual.
export default async function SandboxEvaluationLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	if (!isUuid(id)) notFound()
	const [recording, loaded, tShell] = await Promise.all([
		getSandboxRecording(id),
		loadWorkspace(sandboxTarget(id)),
		getTranslations('Shell')
	])
	if (recording == null) notFound()
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
