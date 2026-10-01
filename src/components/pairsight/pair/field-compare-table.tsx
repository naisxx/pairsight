'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
	ChevronDownIcon,
	EqualIcon,
	MissingIcon,
	NotEqualIcon,
	NotMatchedIcon
} from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { FieldComparison } from '@/server/pairsight/compare'

type State = 'equal' | 'different' | 'oneMissing' | 'bothMissing'
const ICON_SIZE = 15
const LEGEND: State[] = ['equal', 'different', 'oneMissing', 'bothMissing']
// Values a reader compares character by character read in the mono face.
const MONO_ROLES = new Set(['email', 'phone', 'date_of_birth', 'postcode'])
// Splits a value into words, keeping the separators so the text is rebuilt intact.
const SEPARATORS = /([\s,.@+\-/]+)/

function stateOf(field: Pick<FieldComparison, 'comparison'>): State {
	return field.comparison === 'same' ? 'equal' : field.comparison
}

function StateIcon({ state }: { state: State }) {
	if (state === 'different')
		return <NotEqualIcon size={ICON_SIZE} variant="bold" className="text-diff-ink" />
	if (state === 'oneMissing') return <NotMatchedIcon size={ICON_SIZE} className="text-text-muted" />
	if (state === 'bothMissing') return <MissingIcon size={ICON_SIZE} className="text-text-muted" />
	return <EqualIcon size={ICON_SIZE} className="text-text-muted" />
}

// The words of `value` the other record doesn't have, underlined: the part of
// a value that actually differs, not the whole cell.
function DiffText({ value, other }: { value: string; other: string }) {
	const otherWords = new Set(
		other
			.toLowerCase()
			.split(SEPARATORS)
			.filter((part) => part !== '' && !SEPARATORS.test(part))
	)
	return value.split(SEPARATORS).map((part, index) =>
		part === '' || SEPARATORS.test(part) || otherWords.has(part.toLowerCase()) ? (
			<span key={index}>{part}</span>
		) : (
			<mark
				key={index}
				className="text-diff-ink bg-transparent font-semibold underline decoration-[1.5px] underline-offset-[3px]"
			>
				{part}
			</mark>
		)
	)
}

type Row = {
	key: string
	label: string
	isRawHeader: boolean
	a: string
	b: string
	state: State
	isFormatOnly: boolean
	isSent: boolean
	isMono: boolean
}

function FieldValue({
	row,
	side,
	missingLabel
}: {
	row: Row
	side: 'a' | 'b'
	missingLabel: string
}) {
	const value = side === 'a' ? row.a : row.b
	const other = side === 'a' ? row.b : row.a
	if (value.trim() === '')
		return <span className="text-text-muted text-xs italic">{missingLabel}</span>
	return (
		<span className={cn('break-words', row.isMono && 'font-mono text-[0.78125rem]')}>
			{row.state === 'different' ? <DiffText value={value} other={other} /> : value}
		</span>
	)
}

// The two records side by side (docs/PairSight-UX-Plan.md §4.2): one row per
// mapped field, with what differs highlighted down to the word, a legend of
// how many fields agree, and the unmapped columns a click away. Fields Jev
// didn't see are marked "not sent". Tint is never the only signal: every
// row has an icon and a label.
export function FieldCompareTable({
	fields,
	others,
	sentRoles,
	referenceA,
	referenceB
}: {
	fields: FieldComparison[]
	others: Array<{ header: string; a: string; b: string }>
	sentRoles: string[]
	referenceA: string
	referenceB: string
}) {
	const t = useTranslations('Pair')
	const tRoles = useTranslations('Roles')
	const [isShowingAll, setIsShowingAll] = useState(false)

	const mapped: Row[] = fields.map((field) => ({
		key: field.role,
		label: tRoles(field.role),
		isRawHeader: false,
		a: field.a,
		b: field.b,
		state: stateOf(field),
		isFormatOnly: field.isFormatOnly,
		isSent: sentRoles.includes(field.role),
		isMono: MONO_ROLES.has(field.role)
	}))
	const unmapped: Row[] = others.map((other) => ({
		key: `other-${other.header}`,
		label: other.header,
		isRawHeader: true,
		a: other.a,
		b: other.b,
		state:
			other.a.trim() === '' && other.b.trim() === ''
				? 'bothMissing'
				: other.a.trim() === '' || other.b.trim() === ''
					? 'oneMissing'
					: other.a.trim() === other.b.trim()
						? 'equal'
						: 'different',
		isFormatOnly: false,
		isSent: false,
		isMono: false
	}))
	const rows = isShowingAll ? [...mapped, ...unmapped] : mapped
	const counts = Object.fromEntries(
		LEGEND.map((state) => [state, mapped.filter((row) => row.state === state).length])
	)

	return (
		<section
			aria-labelledby="fields-title"
			className="border-border bg-surface overflow-hidden rounded-md border"
		>
			<header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
				<h2 id="fields-title" className="type-subheading">
					{t('fieldsTitle')}
				</h2>
				<ul className="text-text-muted flex flex-wrap gap-3 text-xs">
					{LEGEND.map((state) => (
						<li key={state} className="flex items-center gap-1">
							<StateIcon state={state} />
							{t(`state.${state}`)} <span className="text-text font-mono">{counts[state]}</span>
						</li>
					))}
				</ul>
			</header>

			{/* Side by side from md; stacked A over B on phones. */}
			<div className="hidden md:block">
				<div className="border-border bg-surface-muted text-text-muted grid grid-cols-[150px_minmax(0,1fr)_40px_minmax(0,1fr)] border-y text-xs font-medium">
					<div className="px-4 py-2">{t('field')}</div>
					<div className="px-3 py-2">
						{t('recordA')} · <span className="text-text font-mono">{referenceA}</span>
					</div>
					<div className="py-2" />
					<div className="px-3 py-2">
						{t('recordB')} · <span className="text-text font-mono">{referenceB}</span>
					</div>
				</div>
				<ul>
					{rows.map((row) => {
						const isDifferent = row.state === 'different'
						return (
							<li
								key={row.key}
								className={cn(
									'border-border type-ui grid grid-cols-[150px_minmax(0,1fr)_40px_minmax(0,1fr)] border-b last:border-0',
									row.state === 'bothMissing' && 'text-text-muted'
								)}
							>
								<div className="flex items-start gap-1.5 px-4 py-2.5">
									<span className={cn('text-text-muted', row.isRawHeader && 'font-mono text-xs')}>
										{row.label}
									</span>
									{!row.isSent && !row.isRawHeader && (
										<span className="border-border text-text-muted mt-0.5 rounded-[4px] border px-1 text-[10px]">
											{t('notSent')}
										</span>
									)}
								</div>
								<div className={cn('px-3 py-2.5', isDifferent && 'bg-diff')}>
									<FieldValue row={row} side="a" missingLabel={t('missing')} />
								</div>
								<div
									title={t(`state.${row.state}`)}
									className={cn('flex items-start justify-center py-2.5', isDifferent && 'bg-diff')}
								>
									<StateIcon state={row.state} />
									<span className="sr-only">{t(`state.${row.state}`)}</span>
								</div>
								<div className={cn('px-3 py-2.5', isDifferent && 'bg-diff')}>
									<FieldValue row={row} side="b" missingLabel={t('missing')} />
									{row.isFormatOnly && (
										<span className="text-text-muted ml-2 text-[0.6875rem]">
											{t('formatDiffers')}
										</span>
									)}
								</div>
							</li>
						)
					})}
				</ul>
			</div>
			<ul className="border-border border-t md:hidden">
				{rows.map((row) => (
					<li
						key={row.key}
						className={cn(
							'border-border border-b px-4 py-3 last:border-0',
							row.state === 'different' && 'bg-diff'
						)}
					>
						<div className="text-text-muted flex items-center justify-between text-xs">
							<span>{row.label}</span>
							<span className="flex items-center gap-1">
								<StateIcon state={row.state} />
								{t(`state.${row.state}`)}
							</span>
						</div>
						<div className="type-ui mt-1.5 grid grid-cols-[20px_1fr] gap-x-2 gap-y-1">
							<span className="text-text-muted font-mono text-[0.6875rem]">A</span>
							<FieldValue row={row} side="a" missingLabel={t('missing')} />
							<span className="text-text-muted font-mono text-[0.6875rem]">B</span>
							<FieldValue row={row} side="b" missingLabel={t('missing')} />
						</div>
					</li>
				))}
			</ul>

			{unmapped.length > 0 && (
				<button
					type="button"
					onClick={() => setIsShowingAll((showing) => !showing)}
					aria-expanded={isShowingAll}
					className="border-border text-accent-ink hover:bg-surface-hover flex w-full items-center gap-1.5 border-t px-4 py-2.5 text-xs font-medium transition-colors duration-150"
				>
					<ChevronDownIcon
						size={12}
						className={cn('transition-transform duration-150', isShowingAll && 'rotate-180')}
					/>
					{isShowingAll ? t('hideColumns') : t('showColumns', { count: unmapped.length })}
				</button>
			)}
		</section>
	)
}
