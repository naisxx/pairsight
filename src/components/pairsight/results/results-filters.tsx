import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SearchIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { SEARCH_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import type { ResultFilters } from '@/server/pairsight/results'
import { hasActiveFilters, toQuery } from './query'

// A plain GET form: filters live in the URL and work without client JS.
export function ResultsFilters({ base, filters }: { base: string; filters: ResultFilters }) {
	const t = useTranslations('Results')
	return (
		<form
			method="get"
			action={`${base}/results`}
			className="flex flex-wrap items-center gap-2"
			aria-label={t('filters')}
		>
			{filters.vendor != null && <input type="hidden" name="vendor" value={filters.vendor} />}
			{filters.category != null && <input type="hidden" name="category" value={filters.category} />}
			<div className="relative">
				<SearchIcon className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
				<Input
					type="search"
					name="q"
					defaultValue={filters.q ?? ''}
					maxLength={SEARCH_MAX_LENGTH}
					placeholder={t('search')}
					aria-label={t('search')}
					className="h-8 w-72 pl-8"
				/>
			</div>
			<select
				name="source"
				defaultValue={filters.source ?? ''}
				aria-label={t('filterSource')}
				className="border-border-input bg-surface text-text type-body h-8 rounded border px-2"
			>
				<option value="">{t('sourceAll')}</option>
				<option value="rules">{t('sourceRules')}</option>
				<option value="vendor">{t('sourceVendor')}</option>
			</select>
			<label className="text-text type-body flex items-center gap-2">
				<input
					type="checkbox"
					name="lowConfidence"
					value="1"
					defaultChecked={filters.lowConfidence != null}
					className="accent-action size-4"
				/>
				{t('filterLowConfidence')}
			</label>
			<Button type="submit" size="sm" variant="secondary">
				{t('filters')}
			</Button>
			{hasActiveFilters(filters) && <ClearFiltersLink base={base} vendor={filters.vendor} />}
		</form>
	)
}

export function ClearFiltersLink({ base, vendor }: { base: string; vendor: string | undefined }) {
	const t = useTranslations('Results')
	return (
		<Link
			href={{ pathname: `${base}/results`, query: toQuery({ vendor }) }}
			className="text-accent-ink type-label hover:underline"
		>
			{t('clear')}
		</Link>
	)
}
