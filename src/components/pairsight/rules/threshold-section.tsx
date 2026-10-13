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
			letter={t('letter.threshold')}
			title={
				<>
					{t('thresholdTitle')}
					<InfoTip label={t('thresholdInfoLabel')} content={t('thresholdDescription')} />
				</>
			}
			description={t('thresholdShort')}
			className={className}
		>
			<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
				<span className="text-text font-mono text-[3.5rem] leading-none font-semibold tracking-[-0.03em]">
					{value.toFixed(2)}
				</span>
				<Segmented<Choice>
					isFill="narrow"
					label={t('thresholdTitle')}
					value={choice}
					onChange={choose}
					options={[
						...THRESHOLD_PRESET_NAMES.map((name) => ({
							value: name,
							label: (
								<>
									{t(`threshold_${name}`)}
									<span className="font-mono">{THRESHOLD_PRESETS[name].toFixed(2)}</span>
								</>
							)
						})),
						{ value: 'custom', label: t('thresholdCustom') }
					]}
				/>
			</div>
			{choice === 'custom' && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<label htmlFor="threshold-custom" className="font-semibold">
						{t('thresholdCustomLabel')}
					</label>
					<Input
						id="threshold-custom"
						inputMode="decimal"
						className="w-[96px] text-center font-mono"
						value={text}
						aria-describedby="threshold-custom-hint"
						onChange={(event) => setText(event.target.value)}
						onBlur={commitText}
						onKeyDown={(event) => {
							if (event.key === 'Enter') commitText()
						}}
					/>
					<span id="threshold-custom-hint" className="text-text-muted text-sm">
						{t('thresholdCustomHint', {
							min: MIN_THRESHOLD.toFixed(2),
							max: MAX_THRESHOLD.toFixed(2)
						})}
					</span>
				</div>
			)}
			{/* Where the line sits on Jev's 0-1 score scale, and where scores fall. */}
			<CutoffScale value={value} className="mt-8" />
			<p className="text-text-muted mt-3 text-sm">
				{t(`thresholdNote_${choice}`, { value: value.toFixed(2) })}
			</p>
		</RulesCard>
	)
}
