'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import { OptionSelect } from '@/components/ui/select'
import { PAGE_SIZES } from '@/lib/pairsight/input-limits'

// Rows per page; changing it goes back to the first page.
export function PageSizeSelect({ pageSize }: { pageSize: number }) {
	const t = useTranslations('Results')
	const id = useId()
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	return (
		<>
			<label htmlFor={id} className="text-text-muted">
				{t('rows')}
			</label>
			<OptionSelect
				id={id}
				size="sm"
				className="w-[76px]"
				value={String(pageSize)}
				onValueChange={(value) => {
					const query = new URLSearchParams(searchParams)
					query.set('size', value)
					query.delete('page')
					router.replace(`${pathname}?${query}`)
				}}
				options={[...PAGE_SIZES]
					.sort((a, b) => a - b)
					.map((size) => ({ value: String(size), label: String(size) }))}
			/>
		</>
	)
}
