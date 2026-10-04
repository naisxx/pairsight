'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CloseIcon, SearchIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { OptionSelect, type SelectOption } from '@/components/ui/select'
import { SEARCH_MAX_LENGTH } from '@/lib/pairsight/input-limits'

const SEARCH_DEBOUNCE_MS = 200
// Params a filter change keeps: where you are, not what you're filtering.
const VIEW_PARAMS = ['tab', 'vendor', 'size', 'sort']

// The detailed view's filters (docs/PairSight-UX-Plan.md §4.1). They apply
// as you change them — the URL holds them, the server filters — and the
// search waits for a pause in typing. `/` focuses the search
// (results-keyboard.tsx).
export function PairFilters({
	vendors,
	vendorId,
	matching,
	isFiltered
}: {
	vendors: Array<{ id: string; name: string }>
	vendorId: string | undefined
	matching: number
	isFiltered: boolean
}) {
	const t = useTranslations('Filters')
	const tCat = useTranslations('Categories')
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const urlSearch = searchParams.get('q') ?? ''
	const [search, setSearch] = useState(urlSearch)
	// Back/forward or "Clear filters" change the URL under the box; follow it.
	const [syncedSearch, setSyncedSearch] = useState(urlSearch)
	if (syncedSearch !== urlSearch) {
		setSyncedSearch(urlSearch)
		setSearch(urlSearch)
	}

	function update(changes: Record<string, string | null>) {
		const query = new URLSearchParams(searchParams)
		for (const [key, value] of Object.entries(changes)) {
			if (value == null || value === '') query.delete(key)
			else query.set(key, value)
		}
		// A new filter starts from the first page, without the old highlight.
		query.delete('page')
		query.delete('sel')
		const string = query.toString()
		router.replace(string === '' ? pathname : `${pathname}?${string}`)
	}

	// The search applies after a pause in typing, not on every keystroke.
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	function onSearchChange(value: string) {
		setSearch(value)
		if (searchTimer.current != null) clearTimeout(searchTimer.current)
		searchTimer.current = setTimeout(() => update({ q: value }), SEARCH_DEBOUNCE_MS)
	}
	useEffect(
		() => () => {
			if (searchTimer.current != null) clearTimeout(searchTimer.current)
		},
		[]
	)

	function clear() {
		const query = new URLSearchParams()
		for (const key of VIEW_PARAMS) {
			const value = searchParams.get(key)
			if (value != null) query.set(key, value)
		}
		setSearch('')
		router.replace(query.size === 0 ? pathname : `${pathname}?${query}`)
	}

	const select = (
		param: string,
		label: string,
		options: SelectOption[],
		width: string,
		fallback = ''
	) => (
		<OptionSelect
			size="sm"
			aria-label={label}
			className={width}
			value={searchParams.get(param) ?? fallback}
			onValueChange={(value) => update({ [param]: value })}
			options={options}
		/>
	)

	const score = searchParams.get('score') ?? ''
	const scoreOptions: SelectOption[] = [
		{ value: '', label: t('anyScore') },
		{ value: 'below', label: t('belowThreshold') },
		{ value: 'above', label: t('aboveThreshold') },
		{ value: 'near', label: t('nearThreshold') }
	]
	// A histogram bar's range shows as its own option while it's selected.
	if (score.startsWith('r:')) {
		scoreOptions.push({ value: score, label: t('scoreRange', { range: score.slice(2) }) })
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-full @2xl:w-[260px]">
					<SearchIcon
						size={15}
						className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
					/>
					<Input
						type="search"
						data-results-search
						value={search}
						maxLength={SEARCH_MAX_LENGTH}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={t('searchPlaceholder')}
						aria-label={t('search')}
						className="type-ui h-8 pr-9 pl-8"
					/>
					<span className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 @2xl:block">
						<Kbd>/</Kbd>
					</span>
				</div>
				{select(
					'category',
					t('category'),
					[
						{ value: '', label: t('allCategories') },
						{ value: 'disagreements', label: t('disagreements') },
						...(
							[
								'both_matched',
								'pairsight_only',
								'vendor_only',
								'neither_matched',
								'incomplete'
							] as const
						).map((category) => ({ value: category, label: tCat(category) }))
					],
					'w-[170px]'
				)}
				{vendors.length > 1 &&
					select(
						'vendor',
						t('vendor'),
						vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
						'w-[180px]',
						vendorId
					)}
				{select('score', t('score'), scoreOptions, 'w-[190px]')}
				{select(
					'source',
					t('source'),
					[
						{ value: '', label: t('anySource') },
						{ value: 'rules', label: t('fromRules') },
						{ value: 'fuzzy', label: t('fuzzyRulesOnly') },
						{ value: 'vendor', label: t('addedByVendor') }
					],
					'w-[160px]'
				)}
				{select(
					'status',
					t('status'),
					[
						{ value: '', label: t('anyStatus') },
						{ value: 'evaluated', label: t('assessed') },
						{ value: 'pending', label: t('pending') },
						{ value: 'failed', label: t('failed') }
					],
					'w-[150px]'
				)}
			</div>
			<div className="type-ui flex flex-wrap items-center gap-2">
				<p aria-live="polite" className="text-text-muted">
					{t.rich('matching', {
						count: matching,
						n: (chunks) => <span className="text-text font-mono">{chunks}</span>
					})}
				</p>
				{isFiltered && (
					<Button variant="quiet" size="sm" className="h-7 px-2" onClick={clear}>
						<CloseIcon size={13} />
						{t('clear')}
					</Button>
				)}
			</div>
		</div>
	)
}
