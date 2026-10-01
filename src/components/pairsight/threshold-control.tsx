'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { CATEGORIES, categorize, type Category } from '@/lib/pairsight/decisions'
import { updateThresholdAction } from '@/server/actions/pairsight/runs'
import { CategoryDot } from './result-parts'
import { ScoreHistogram, type JudgedScore } from './results/score-histogram'

const STEP = 0.01

function countAt(scores: JudgedScore[], threshold: number): Record<Category, number> {
	const counts: Record<Category, number> = {
		both_matched: 0,
		pairsight_only: 0,
		vendor_only: 0,
		neither_matched: 0
	}
	for (const { score, isVendorMatch } of scores) {
		const category = categorize({ isVendorMatch, status: 'succeeded', score, threshold })
		if (category !== 'incomplete') counts[category]++
	}
	return counts
}

// The decision threshold, behind a button showing its value. The popover
// shows how Jev's scores spread around it and previews how the categories
// change before anything is saved. Applying re-decides from saved scores;
// Jev is never called again (docs/PairSight-V1-Scope.md, "Runs and reuse").
export function ThresholdControl({
	runId,
	threshold,
	initialThreshold,
	judged
}: {
	runId: string
	threshold: number
	// What the run started with; null for runs from before it was recorded.
	initialThreshold: number | null
	judged: JudgedScore[]
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	const router = useRouter()
	const id = useId()
	const [isOpen, setIsOpen] = useState(false)
	const [text, setText] = useState(threshold.toFixed(2))
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const parsed = Number(text)
	const isValid = text !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
	const draft = isValid ? parsed : threshold
	const current = countAt(judged, threshold)
	const preview = countAt(judged, draft)
	const changed = CATEGORIES.filter((category) => current[category] !== preview[category])

	return (
		<Popover
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open)
				if (open) {
					setText(threshold.toFixed(2))
					setError(null)
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					{t('thresholdTrigger')}
					<span className="type-data">{threshold.toFixed(2)}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-[22rem] flex-col gap-4">
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault()
						if (!isValid) return
						startTransition(async () => {
							setError(null)
							const result = await updateThresholdAction({ runId, threshold: parsed })
							if (!result.ok) {
								setError(result.error)
								return
							}
							setIsOpen(false)
							router.refresh()
						})
					}}
				>
					<div className="flex flex-col gap-1">
						<h2 className="text-text type-subheading">{t('thresholdLabel')}</h2>
						<p id={`${id}-help`} className="text-text-muted type-meta">
							{t('thresholdHelp')}
						</p>
					</div>
					<ScoreHistogram scores={judged} threshold={draft} />
					<div className="flex items-end gap-3">
						<Slider
							min={0}
							max={1}
							step={STEP}
							value={[draft]}
							onValueChange={([value]) => {
								if (value != null) setText(value.toFixed(2))
							}}
							thumbLabel={t('thresholdSlider')}
							className="mb-2.5 flex-1"
						/>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`${id}-threshold`} className="type-meta font-medium">
								{t('thresholdLabel')}
							</Label>
							<Input
								id={`${id}-threshold`}
								type="number"
								min={0}
								max={1}
								step={STEP}
								value={text}
								onChange={(event) => setText(event.target.value)}
								className="type-data h-8 w-20"
								aria-describedby={`${id}-help`}
								aria-invalid={!isValid}
							/>
						</div>
					</div>
					{initialThreshold != null && initialThreshold !== threshold && (
						<p className="text-text-muted type-meta flex flex-wrap items-center gap-x-2">
							{t('thresholdStartedAt', { threshold: initialThreshold.toFixed(2) })}
							<button
								type="button"
								onClick={() => setText(initialThreshold.toFixed(2))}
								className="text-accent-ink type-label focus-visible:outline-ring rounded hover:underline focus-visible:outline-2"
							>
								{t('thresholdUseInitial')}
							</button>
						</p>
					)}
					<div aria-live="polite" className="flex flex-col gap-1">
						<p className="text-text type-label">
							{t('previewTitle', { threshold: draft.toFixed(2) })}
						</p>
						{changed.length === 0 ? (
							<p className="text-text-muted type-meta">{t('previewNoChange')}</p>
						) : (
							<ul className="flex flex-col gap-1">
								{changed.map((category) => (
									<li key={category} className="type-body flex items-center justify-between gap-3">
										<span className="text-text flex items-center gap-2">
											<CategoryDot category={category} />
											{tCat(category)}
										</span>
										<span className="text-text-muted type-data">
											{current[category]} → <span className="text-text">{preview[category]}</span>
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
					{error != null && (
						<p role="alert" className="text-danger type-meta">
							{error}
						</p>
					)}
					<Button
						type="submit"
						size="sm"
						className="self-end"
						disabled={!isValid || isPending || parsed === threshold}
					>
						{isPending && <SpinnerIcon />}
						{t('thresholdApply')}
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	)
}
