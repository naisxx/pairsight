'use client'

import { LOW_CONFIDENCE_BAND } from '@/lib/pairsight/decisions'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CloseIcon, FilterIcon, SearchIcon } from '@/components/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { OptionSelect, type SelectOption } from '@/components/ui/select'
import { SEARCH_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { exactTitle } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'

const SEARCH_DEBOUNCE_MS = 200
// Params a filter change keeps: where you are, not what you're filtering.
const VIEW_PARAMS = ['tab', 'vendor', 'size', 'sort']

// The detailed view's toolbar (docs/PairSight-UX-Plan.md §4.1): all pairs or
// just the disagreements, which vendor, a search, and the rest of the filters
// folded into one "Filters" menu. They apply as you change them — the URL
// holds them, the server filters — and the search waits for a pause in
// typing. `/` focuses the search (results-keyboard.tsx).
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
		{ value: 'near', label: t('nearThreshold', { band: LOW_CONFIDENCE_BAND.toFixed(2) }) }
	]
	// A histogram bar's range shows as its own option while it's selected.
	if (score.startsWith('r:')) {
		scoreOptions.push({ value: score, label: t('scoreRange', { range: score.slice(2) }) })
	}

	const category = searchParams.get('category') ?? ''
	// The groups the toggle doesn't cover (a tile on the Overview picks one)
	// show as a third option while they're chosen.
	const viewOptions = [
		{ value: 'all', label: t('allPairs') },
		{ value: 'disagreements', label: t('disagreements') },
		...(category !== '' && category !== 'disagreements' && isCategory(category)
			? [{ value: category, label: tCat(category) }]
			: [])
	]
	const sourceOptions: SelectOption[] = [
		{ value: '', label: t('anySource') },
		{ value: 'suggested', label: t('suggestedByPairSight') },
		{ value: 'vendor', label: t('addedByVendor') }
	]
	const statusOptions: SelectOption[] = [
		{ value: '', label: t('anyStatus') },
		{ value: 'evaluated', label: t('assessed') },
		{ value: 'pending', label: t('pending') },
		{ value: 'failed', label: t('failed') }
	]
	const menuFilters = [
		['score', t('score'), scoreOptions],
		['source', t('source'), sourceOptions],
		['status', t('status'), statusOptions]
	] as const
	// Each filter in force, as a chip beside the count that takes it off: so
	// what's narrowing the list is on screen, not folded into the menu. Close
	// calls come from a link on the Overview, not the menu.
	const active = [
		...menuFilters.flatMap(([param, label, options]) => {
			const value = searchParams.get(param) ?? ''
			const option = options.find((candidate) => candidate.value === value)
			return value === '' || option == null
				? []
				: [{ param, label: t('chip', { filter: label, value: option.label }) }]
		}),
		...(searchParams.get('lowConfidence') != null
			? [
					{
						param: 'lowConfidence',
						label: t('nearThreshold', { band: LOW_CONFIDENCE_BAND.toFixed(2) })
					}
				]
			: [])
	]

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Segmented
					label={t('category')}
					value={category === '' ? 'all' : category}
					onChange={(value) => update({ category: value === 'all' ? null : value })}
					options={viewOptions}
				/>
				{vendors.length > 1 && vendorId != null && (
					<Segmented
						label={t('vendor')}
						value={vendorId}
						onChange={(value) => update({ vendor: value })}
						options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
					/>
				)}
				<div className="relative w-full @2xl:ml-auto @2xl:w-[240px]">
					<SearchIcon
						size={15}
						className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
					/>
					<Input
						type="search"
						data-results-search
						aria-keyshortcuts="/"
						value={search}
						maxLength={SEARCH_MAX_LENGTH}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={t('searchPlaceholder')}
						aria-label={t('search')}
						className="type-ui h-9 pr-9 pl-8"
					/>
					<span className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 @2xl:block">
						<Kbd>/</Kbd>
					</span>
				</div>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="secondary" size="sm" className="h-9">
							<FilterIcon size={14} />
							{t('more')}
							{active.length > 0 && (
								<span className="bg-action text-action-ink rounded-full px-1.5 font-mono text-[0.6875rem]">
									{active.length}
								</span>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="flex w-[280px] flex-col gap-3 p-4">
						{menuFilters.map(([param, label, options]) => (
							<label key={param} className="type-ui flex flex-col gap-1 font-medium">
								{label}
								{select(param, label, [...options], 'w-full')}
							</label>
						))}
					</PopoverContent>
				</Popover>
			</div>
			<div className="type-ui flex flex-wrap items-center gap-2">
				<p
					aria-live="polite"
					className="text-text-muted"
					title={exactTitle([matching], () =>
						t.markup('matching', { count: matching, n: (chunks) => chunks }, EXACT_FORMATS)
					)}
				>
					{t.rich('matching', {
						count: matching,
						n: (chunks) => <span className="text-text font-mono">{chunks}</span>
					})}
				</p>
				{active.map((filter) => (
					<span
						key={filter.param}
						className="bg-accent text-accent-ink inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-xs font-medium pointer-coarse:h-11"
					>
						{filter.label}
						<button
							type="button"
							onClick={() => update({ [filter.param]: null })}
							aria-label={t('removeFilter', { filter: filter.label })}
							className="hover:bg-surface-hover hit-area flex size-5 items-center justify-center rounded-full transition-colors duration-150"
						>
							<CloseIcon size={11} />
						</button>
					</span>
				))}
				{isFiltered && (
					<Button
						variant="quiet"
						size="sm"
						className="h-7 px-2 pointer-coarse:h-11"
						onClick={clear}
					>
						<CloseIcon size={13} />
						{t('clear')}
					</Button>
				)}
			</div>
		</div>
	)
}

const CATEGORY_VALUES = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched',
	'incomplete'
] as const

function isCategory(value: string): value is (typeof CATEGORY_VALUES)[number] {
	return CATEGORY_VALUES.some((category) => category === value)
}
