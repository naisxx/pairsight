import { useTranslations } from 'next-intl'
import { CsvFileIcon, XlsxFileIcon, type IconProps } from '@/components/ui/icons'
import { tabularFormatOf } from '@/lib/pairsight/tabular-formats'

// A file's icon, by the format its name says it is.
export function TabularFileIcon({ fileName, ...props }: IconProps & { fileName: string }) {
	return tabularFormatOf(fileName) === 'xlsx' ? (
		<XlsxFileIcon {...props} />
	) : (
		<CsvFileIcon {...props} />
	)
}

// What a file is, as the file bars say it: "CSV", or "Excel · Sheet Customers"
// when a workbook's sheet was chosen.
export function useFileTypeLabel() {
	const t = useTranslations('FileType')
	return (fileName: string, sheet?: string) => {
		const format = tabularFormatOf(fileName) ?? 'csv'
		return sheet == null ? t(format) : `${t(format)} · ${t('sheet', { name: sheet })}`
	}
}
