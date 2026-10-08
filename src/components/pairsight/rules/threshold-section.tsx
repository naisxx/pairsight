'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTip } from '@/components/ui/info-tip'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import {
	MAX_THRESHOLD,
	MIN_THRESHOLD,
	THRESHOLD_PRESET_NAMES,
	THRESHOLD_PRESETS,
	thresholdPreset,
	type ThresholdPreset
} from '@/lib/pairsight/decisions'
import { CutoffScale } from '../cutoff-scale'
import { RulesCard } from './rules-card'

const PERCENT = 100
type Choice = ThresholdPreset | 'custom'

// Two decimals, inside the bounds; null when the text isn't a number.
function parseThreshold(text: string): number | null {
	const value = Number(text)
	if (text.trim() === '' || !Number.isFinite(value)) return null
	return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value * PERCENT) / PERCENT))
}

// How sure Jev must be for a pair to count as a PairSight match: three named
// presets or a custom value. It's a setup choice, made before any results are
// seen, and the next run keeps it (docs/PairSight-UX-Plan.md, "What shipped").
// Jev scores every pair the same way whatever it is; it only moves the line.
export function ThresholdSection({
	value,
	onChange,
	className
}: {
	value: number
	onChange: (value: number) => void
	className?: string
}) {
	const t = useTranslations('Rules')
	// Custom is a choice of its own: picking it keeps the current value until
	// a new one is typed, even when that value happens to match a preset.
	const [isCustom, setIsCustom] = useState(() => thresholdPreset(value) == null)
	const [text, setText] = useState(value.toFixed(2))
	const choice: Choice = isCustom ? 'custom' : (thresholdPreset(value) ?? 'custom')

	function choose(next: Choice) {
		if (next === 'custom') {
			setIsCustom(true)
			setText(value.toFixed(2))
			return
		}
		setIsCustom(false)
		onChange(THRESHOLD_PRESETS[next])
	}

	function commitText() {
		const parsed = parseThreshold(text)
		if (parsed == null) {
			setText(value.toFixed(2))
			return
		}
		setText(parsed.toFixed(2))
		onChange(parsed)
	}

	return (
		<RulesCard
			id="threshold"
			eyebrow={t('thresholdEyebrow')}
			title={
				<>
					{t('thresholdTitle')}
					<InfoTip label={t('thresholdInfoLabel')} content={t('thresholdDescription')} />
				</>
			}
			description={t('thresholdShort')}
			className={className}
		>
			<p className="flex items-baseline gap-2">
				<span className="font-mono text-5xl leading-none font-medium tracking-[-0.04em]">
					{value.toFixed(2)}
				</span>
				<span className="type-ui text-text-muted">
					{choice === 'custom' ? t('thresholdCustom') : t(`threshold_${choice}`)}
				</span>
			</p>
			<div className="mt-5 space-y-3">
				<Segmented<Choice>
					label={t('thresholdTitle')}
					value={choice}
					onChange={choose}
					options={[
						...THRESHOLD_PRESET_NAMES.map((name) => ({
							value: name,
							label: (
								<>
									{t(`threshold_${name}`)}
									<span className="font-mono text-xs">{THRESHOLD_PRESETS[name].toFixed(2)}</span>
								</>
							)
						})),
						{ value: 'custom', label: t('thresholdCustom') }
					]}
					isFill
				/>
				{choice === 'custom' && (
					<div className="flex flex-wrap items-center gap-3">
						<label htmlFor="threshold-custom" className="type-ui font-medium">
							{t('thresholdCustomLabel')}
						</label>
						<Input
							id="threshold-custom"
							inputMode="decimal"
							className="h-8 w-[84px] text-center font-mono"
							value={text}
							aria-describedby="threshold-custom-hint"
							onChange={(event) => setText(event.target.value)}
							onBlur={commitText}
							onKeyDown={(event) => {
								if (event.key === 'Enter') commitText()
							}}
						/>
						<span id="threshold-custom-hint" className="text-text-muted text-xs">
							{t('thresholdCustomHint', {
								min: MIN_THRESHOLD.toFixed(2),
								max: MAX_THRESHOLD.toFixed(2)
							})}
						</span>
					</div>
				)}
			</div>
			{/* Where the line sits on Jev's 0–1 score scale, and where scores fall. */}
			<div className="mt-auto pt-6">
				<CutoffScale value={value} />
				<p className="type-ui text-text-muted mt-3">
					{t(`thresholdNote_${choice}`, { value: value.toFixed(2) })}
				</p>
			</div>
		</RulesCard>
	)
}
