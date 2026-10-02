import { getTranslations } from 'next-intl/server'
import { InView } from '@/components/ui/in-view'
import {
	CheckIcon,
	MinusIcon,
	PlayIcon,
	SlidersIcon,
	SuccessIcon,
	TableIcon
} from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { CategoryBadge, ScoreBar } from '../result-parts'

const POINT_ICON_SIZE = 18
const SMALL_ICON = 12
const SCORE_BAR_WIDTH = 56
const THRESHOLD = 0.5
const RUN_PROGRESS_PERCENT = 100

const POINTS = [
	{ title: 'look1Title', body: 'look1Body', Icon: TableIcon },
	{ title: 'look2Title', body: 'look2Body', Icon: PlayIcon },
	{ title: 'look3Title', body: 'look3Body', Icon: SlidersIcon }
] as const

// Two fictional records, compared field by field, as on the Pair page.
const FIELDS = [
	{ role: 'full_name', a: 'Jane Smith', b: 'Jane Smyth', isSame: false },
	{ role: 'email', a: 'jane@mail.test', b: 'jane@mail.test', isSame: true },
	{ role: 'phone', a: '(415) 555-0101', b: '415-555-0101', isSame: true }
] as const

// "A closer look": what you get once a run is done, beside a layered picture
// of two of its screens (a pair compared field by field, and the run's card)
// that drift apart at different depths as the section scrolls by.
export async function CloserLook() {
	const [t, tRoles] = await Promise.all([getTranslations('HomePage'), getTranslations('Roles')])
	const panel = 'border-border bg-surface rounded-lg border shadow-[0_16px_40px_rgb(15_23_32/0.12)]'
	return (
		<section aria-labelledby="look-title" className="mx-auto max-w-[1200px] px-5 py-20 md:px-8">
			<InView className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
				<div className="lg:col-span-5">
					<div className="on-view">
						<p className="text-accent-ink text-xs font-semibold tracking-wide uppercase">
							{t('lookEyebrow')}
						</p>
						<h2
							id="look-title"
							className="mt-2 text-2xl font-semibold tracking-[-0.015em] md:text-[28px]"
						>
							{t('lookTitle')}
						</h2>
					</div>
					<ul className="mt-8 space-y-5">
						{POINTS.map(({ title, body, Icon }, index) => (
							<li key={title} className={`on-view stagger-${index + 1} flex gap-4`}>
								<span className="bg-accent text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-md">
									<Icon size={POINT_ICON_SIZE} />
								</span>
								<span>
									<span className="block text-[15px] font-semibold">{t(title)}</span>
									<span className="text-text-muted mt-1 block text-sm leading-relaxed">
										{t(body)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</div>

				<div aria-hidden className="relative h-[380px] lg:col-span-7">
					<div className={cn(panel, 'parallax depth-back absolute top-0 left-0 w-[78%] p-4')}>
						<div className="flex items-center justify-between gap-2">
							<span className="text-sm font-semibold">Jane Smith ⇄ Jane Smyth</span>
							<CategoryBadge category="pairsight_only" />
						</div>
						<dl className="border-border mt-3 divide-y divide-[var(--border)] rounded-md border text-[11px]">
							{FIELDS.map((field) => (
								<div
									key={field.role}
									className="grid grid-cols-[4.5rem_1fr_1fr] gap-2 px-2.5 py-1.5"
								>
									<dt className="text-text-muted">{tRoles(field.role)}</dt>
									<dd
										className={cn(
											'font-mono',
											!field.isSame && 'text-diff-ink font-semibold underline'
										)}
									>
										{field.a}
									</dd>
									<dd
										className={cn(
											'font-mono',
											!field.isSame && 'text-diff-ink font-semibold underline'
										)}
									>
										{field.b}
									</dd>
								</div>
							))}
						</dl>
						<div className="mt-3 flex items-center justify-between text-[11px]">
							<span className="text-text-muted">{t('visualJev')}</span>
							<ScoreBar
								score={0.92}
								threshold={THRESHOLD}
								width={SCORE_BAR_WIDTH}
								className="text-[11px]"
							/>
						</div>
					</div>

					<div className={cn(panel, 'parallax depth-3 absolute right-0 bottom-0 w-[62%] p-4')}>
						<div className="flex items-center gap-2 text-sm font-semibold">
							<SuccessIcon size={15} variant="solid" className="text-success" />
							{t('lookRunTitle')}
						</div>
						<p className="text-text-muted mt-0.5 text-[11px]">{t('lookRunMeta')}</p>
						<div className="bg-border mt-3 h-1.5 overflow-hidden rounded-full">
							<div
								className="bg-action h-full rounded-full"
								style={{ width: `${RUN_PROGRESS_PERCENT}%` }}
							/>
						</div>
						<ul className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
							<li className="border-border rounded-full border px-2 py-0.5">{t('lookRunPairs')}</li>
							<li className="border-border rounded-full border px-2 py-0.5">
								{t('lookRunThreshold')}
							</li>
						</ul>
						<ul className="mt-3 space-y-1 text-[11px]">
							<li className="flex items-center gap-1.5">
								<CheckIcon size={SMALL_ICON} /> {t('lookRunReused')}
							</li>
							<li className="text-text-muted flex items-center gap-1.5">
								<MinusIcon size={SMALL_ICON} /> {t('lookRunFailed')}
							</li>
						</ul>
					</div>
				</div>
			</InView>
		</section>
	)
}
