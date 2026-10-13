'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '../theme-toggle'
import { Wordmark } from '../wordmark'
import { RunsTrigger } from '../runs/runs-trigger'
import { AccountMenu } from './account-menu'
import type { Crumb, PipelineData, ShellViewer } from './pipeline-types'
import { EvaluationStatusChip } from './status-chip'

const EVALUATIONS_HREF = '/evaluations'

// An underlined text link, the top bar's quiet way to another section.
const TEXT_LINK_CLASS_NAME =
	'text-text decoration-border-strong hover:decoration-text inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-[3px] transition-[text-decoration-color] duration-150'

// The slim bar over every app page (pairsight-handoff Components): the mark,
// where you are (home / evaluation, with the sandbox's tag), then the
// evaluation's status, Runs, the way back to your evaluations from the
// sandbox, the theme switch and the account. In the sandbox, signed out, the last two are Sign
// in and the way to an account of your own. The steps live in the dock.
export function TopBar({
	crumbs,
	homeHref,
	pipeline,
	viewer,
	badge
}: {
	crumbs: Crumb[]
	homeHref: string
	pipeline?: PipelineData
	viewer: ShellViewer
	// Beside the breadcrumb: the sandbox's "read-only demo" tag.
	badge?: React.ReactNode
}) {
	const t = useTranslations('Shell')
	const tSandbox = useTranslations('Sandbox')
	const pathname = usePathname()

	return (
		<header className="shrink-0 px-4 md:px-8">
			<div className="border-border mx-auto flex min-h-16 max-w-[1216px] flex-wrap items-center gap-x-4 gap-y-1 border-b py-2.5">
				<Link
					href={homeHref}
					aria-label={t('home')}
					className="inline-flex min-h-11 shrink-0 items-center"
				>
					{/* Inside an evaluation a phone keeps the tiles only, so its name has
					    room beside them; the link is still named "home". */}
					<Wordmark
						labelClassName={crumbs.length > 1 ? 'max-[599px]:sr-only' : 'max-[380px]:sr-only'}
					/>
				</Link>
				{/* Below a wide screen the actions take the first row, so where you are gets
				    a row of its own; it never wraps, the evaluation's name truncating
				    first. A phone keeps its own layout (only the last crumb). */}
				<nav
					aria-label={t('breadcrumb')}
					className="min-w-0 flex-1 min-[600px]:max-xl:order-last min-[600px]:max-xl:basis-full"
				>
					<ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] min-[600px]:flex-nowrap">
						{crumbs.map((crumb, index) => {
							const isLast = index === crumbs.length - 1
							return (
								<li
									key={`${crumb.label}-${index}`}
									// On a phone only where you are stays: the mark already leads
									// back to the start, and the bar keeps to two rows.
									className={cn(
										'flex min-w-0 items-center gap-2',
										!isLast && 'shrink-0 max-[599px]:hidden'
									)}
								>
									{index > 0 && (
										<span aria-hidden className="text-text-muted max-[599px]:hidden">
											/
										</span>
									)}
									{crumb.href != null && !isLast ? (
										<Link href={crumb.href} className={cn(TEXT_LINK_CLASS_NAME, 'truncate')}>
											{crumb.label}
										</Link>
									) : (
										<span
											aria-current={pathname === crumb.href ? 'page' : undefined}
											className="text-text truncate font-semibold"
										>
											{crumb.label}
										</span>
									)}
								</li>
							)
						})}
						{badge != null && <li className="flex shrink-0 items-center">{badge}</li>}
					</ol>
				</nav>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{pipeline != null && (
						<div className="hidden sm:block">
							<EvaluationStatusChip status={pipeline.status} />
						</div>
					)}
					<RunsTrigger />
					{viewer == null ? (
						<Link href="/sign-in" className={cn(TEXT_LINK_CLASS_NAME, 'px-1')}>
							{t('signIn')}
						</Link>
					) : (
						// In the sandbox, the way back to your own; elsewhere the
						// breadcrumb already starts there.
						homeHref !== EVALUATIONS_HREF && (
							<Link href={EVALUATIONS_HREF} className={cn(TEXT_LINK_CLASS_NAME, 'px-1')}>
								{t('evaluations')}
							</Link>
						)
					)}
					<ThemeToggle />
					{viewer == null ? (
						<Button asChild>
							<Link href="/sign-up">
								{/* One line on a phone, so the page starts sooner. */}
								<span className="sm:hidden">{tSandbox('signUpShort')}</span>
								<span className="hidden sm:inline">{tSandbox('signUp')}</span>
							</Link>
						</Button>
					) : (
						<AccountMenu email={viewer.email} name={viewer.name} />
					)}
				</div>
			</div>
		</header>
	)
}
