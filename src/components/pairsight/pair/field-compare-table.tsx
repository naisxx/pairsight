'use client'

import { formatNoteKind } from '@/lib/pairsight/format-note'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { FieldComparison } from '@/server/pairsight/compare'
import { Glyph, type GlyphKind } from '../glyph'

type State = 'equal' | 'different' | 'oneMissing' | 'bothMissing'
// In the order the rows come: what differs first.
const LEGEND: State[] = ['different', 'equal', 'oneMissing', 'bothMissing']
// Each state's tile: ice equals, vermilion not-equals, grey for a gap.
const STATE_GLYPH: Record<State, GlyphKind> = {
	equal: 'same',
	different: 'different',
	oneMissing: 'missing',
	bothMissing: 'missing'
}
// Splits a value into words, keeping the separators so the text is rebuilt intact.
const SEPARATORS = /([\s,.@+\-/]+)/

function stateOf(field: Pick<FieldComparison, 'comparison'>): State {
	return field.comparison === 'same' ? 'equal' : field.comparison
}

// Where a row sorts: what tells the two records apart first (differences,
// then the same value written differently, then a gap on one side), plain
// agreement after, and fields neither record has last.
function rankOf(row: Pick<Row, 'state' | 'isFormatOnly'>): number {
	if (row.state === 'different') return 0
	if (row.state === 'equal' && row.isFormatOnly) return 1
	if (row.state === 'oneMissing') return 2
	if (row.state === 'equal') return 3
	return 4
}

// Stable: within a rank, the file's own column order.
function byRank(rows: Row[]): Row[] {
	return [...rows].sort((a, b) => rankOf(a) - rankOf(b))
}

// The words of `value` the other record doesn't have, underlined: the part of
// a value that actually differs, not the whole cell.
// A line may break after a separator inside a value (the "@" or a "." of an
// email), so long values wrap there rather than mid-word.
function breakAfter(part: string) {
	return SEPARATORS.test(part) && !/\s/.test(part) ? <wbr /> : null
}

function BreakableText({ value }: { value: string }) {
	return value.split(SEPARATORS).map((part, index) => (
		<span key={index}>
			{part}
			{breakAfter(part)}
		</span>
	))
}

export function DiffText({ value, other }: { value: string; other: string }) {
	const otherWords = new Set(
		other
			.toLowerCase()
			.split(SEPARATORS)
			.filter((part) => part !== '' && !SEPARATORS.test(part))
	)
	return value.split(SEPARATORS).map((part, index) =>
		part === '' || SEPARATORS.test(part) || otherWords.has(part.toLowerCase()) ? (
			<span key={index}>
				{part}
				{breakAfter(part)}
			</span>
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
		return <span className="text-text-muted font-sans text-sm italic">{missingLabel}</span>
	return (
		<span className="break-words">
			{row.state === 'different' ? (
				<DiffText value={value} other={other} />
			) : (
				<BreakableText value={value} />
			)}
		</span>
	)
}

// The two records side by side (docs/PairSight-UX-Plan.md §4.2,
// pairsight-handoff Pair): one row per mapped field with a same, different or
// missing tile between the values, what differs marked down to the word and
// listed first (rankOf), a legend of how many fields agree, and the unmapped
// columns a click away.
// Fields Jev didn't see are marked. Colour is never the only signal: every
// tile has its symbol and a label.
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
		isSent: sentRoles.includes(field.role)
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
		isSent: false
	}))
	const rows = isShowingAll ? [...byRank(mapped), ...byRank(unmapped)] : byRank(mapped)
	const counts = Object.fromEntries(
		LEGEND.map((state) => [state, mapped.filter((row) => row.state === state).length])
	)

	const sentCount = mapped.filter((row) => row.isSent).length
	const grid = 'grid grid-cols-[190px_minmax(0,1fr)_56px_minmax(0,1fr)]'

	return (
		<section
			aria-labelledby="fields-title"
			className="border-border bg-surface rounded-lg border p-6 md:p-7"
		>
			<header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
				<h2
					id="fields-title"
					className="text-text font-display text-2xl leading-tight font-semibold tracking-[-0.025em]"
				>
					{t('fieldsTitle')}
				</h2>
				<ul className="text-text-body flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm">
					{LEGEND.filter((state) => state !== 'bothMissing' || (counts[state] ?? 0) > 0).map(
						(state) => (
							// None of a kind is worth knowing, so it stays, quieter.
							<li
								key={state}
								className={cn(
									'flex items-center gap-2',
									counts[state] === 0 && 'text-text-muted [&>span:first-child]:opacity-50'
								)}
							>
								<Glyph kind={STATE_GLYPH[state]} className="size-[22px] text-xs" />
								{t(`state.${state}`)} <span className="font-mono">{counts[state]}</span>
							</li>
						)
					)}
				</ul>
			</header>

			{/* Side by side from md; stacked A over B on phones. */}
			<div className="mt-5 hidden @3xl:block">
				<div
					className={cn(
						grid,
						'text-text-muted pb-3.5 font-mono text-xs tracking-[0.06em] uppercase'
					)}
				>
					<div>{t('field')}</div>
					<div className="pr-4">
						{t('recordA')} · {referenceA}
					</div>
					<div />
					<div>
						{t('recordB')} · {referenceB}
					</div>
				</div>
				<ul>
					{rows.map((row) => (
						<li
							key={row.key}
							className={cn(
								grid,
								'border-border items-center border-t py-3.5 font-mono text-[0.9375rem]',
								row.state === 'bothMissing' && 'text-text-muted'
							)}
						>
							<div className="flex flex-wrap items-center gap-1.5 pr-4 font-sans">
								<span
									className={cn('text-text-muted text-sm', row.isRawHeader && 'font-mono text-xs')}
								>
									{row.label}
								</span>
								{!row.isSent && !row.isRawHeader && (
									<span className="border-border text-text-muted rounded-[4px] border px-1 text-[10px]">
										{t('notSent')}
									</span>
								)}
							</div>
							<div className="pr-4">
								<FieldValue row={row} side="a" missingLabel={t('missing')} />
							</div>
							<div title={t(`state.${row.state}`)} className="flex justify-center">
								<Glyph kind={STATE_GLYPH[row.state]} />
								<span className="sr-only">{t(`state.${row.state}`)}</span>
							</div>
							<div>
								<FieldValue row={row} side="b" missingLabel={t('missing')} />
								{row.isFormatOnly && (
									<span className="text-text-muted ml-2 font-sans text-sm">
										· {t('formatNote', { kind: formatNoteKind(row.a, row.b) })}
									</span>
								)}
							</div>
						</li>
					))}
				</ul>
			</div>
			<ul className="border-border mt-4 border-t @3xl:hidden">
				{rows.map((row) => (
					<li key={row.key} className="border-border border-b py-3 last:border-0">
						<div className="text-text-muted flex items-center justify-between text-sm">
							<span>{row.label}</span>
							<span className="flex items-center gap-1.5">
								<Glyph kind={STATE_GLYPH[row.state]} className="size-[22px] text-xs" />
								{t(`state.${row.state}`)}
							</span>
						</div>
						<div className="mt-1.5 grid grid-cols-[20px_1fr] gap-x-2 gap-y-1 font-mono text-[0.9375rem]">
							<span className="text-text-muted text-xs leading-6">A</span>
							<FieldValue row={row} side="a" missingLabel={t('missing')} />
							<span className="text-text-muted text-xs leading-6">B</span>
							<FieldValue row={row} side="b" missingLabel={t('missing')} />
						</div>
					</li>
				))}
			</ul>

			<p className="text-text-muted border-border mt-4 border-t pt-4 text-sm">
				{t('valuesJevSaw', { count: sentCount })}
				{unmapped.length > 0 && (
					<>
						{' '}
						<button
							type="button"
							onClick={() => setIsShowingAll((showing) => !showing)}
							aria-expanded={isShowingAll}
							className="text-text decoration-border-strong hover:decoration-text hit-area underline underline-offset-[3px] transition-[text-decoration-color] duration-150"
						>
							{isShowingAll ? t('hideColumns') : t('showColumns', { count: unmapped.length })}
						</button>
					</>
				)}
			</p>
		</section>
	)
}
