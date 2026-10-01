import { Link } from '@/i18n/routing'
import { ErrorPage, errorPageActionClassName } from '@/components/error-page'
import { NotFoundIcon } from '@/components/ui/icons'
import { getSessionUser } from '@/server/auth/session'

// Signed in, the way back is your evaluations; "/" is the signed-out landing.
export default async function NotFound() {
	const user = await getSessionUser()
	return (
		<ErrorPage
			icon={NotFoundIcon}
			title="Page not found"
			description="The page you're looking for doesn't exist or may have moved."
			action={
				<Link href={user == null ? '/' : '/evaluations'} className={errorPageActionClassName}>
					{user == null ? 'Go home' : 'Back to evaluations'}
				</Link>
			}
		/>
	)
}
