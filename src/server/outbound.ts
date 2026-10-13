import 'server-only'
import { env } from '@/lib/env'
import { isOnPrem } from '@/server/deployment'
import { log } from '@/server/lib/logger'

// Logged once at boot: every service outside this machine the server is set
// up to contact. On-prem (docs/PairSight-OnPrem.md) that should be Jev alone,
// and anything else is called out, since a customer installed it on the
// promise that nothing but Jev calls leaves.
export function logOutboundServices(): void {
	const services = [
		`Jev (${new URL(env.TYPESAFE_API_BASE_URL).host}, unless Settings names another)`,
		...(isOnPrem() ? [] : ['OpenRouter (AI usage prices, daily)']),
		...(env.NEXT_PUBLIC_SENTRY_DSN ? ['Sentry (error reports)'] : []),
		...(env.NEXT_PUBLIC_POSTHOG_KEY ? ['PostHog (usage analytics)'] : []),
		...(env.SLACK_ALERT_WEBHOOK_URL ? ['Slack (error alerts)'] : [])
	]
	log.info(`outbound services: ${services.join('; ')}`)
	if (isOnPrem() && services.length > 1) {
		log.warn('on-prem, but configured to reach more than Jev: unset the others')
	}
	if (isOnPrem() && env.TYPESAFE_API_KEY) {
		log.warn('on-prem ignores TYPESAFE_API_KEY: runs use the key an admin saves in Settings')
	}
}
