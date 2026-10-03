// The file formats PairSight reads and writes, and the upload size limit:
// client-safe, so the drop zone and the server check the same list. A format
// is added here once its adapter exists (src/server/pairsight/tabular/).

export const TABULAR_FORMATS = [
	{ format: 'csv', extensions: ['.csv'], mimeType: 'text/csv' },
	{
		format: 'xlsx',
		extensions: ['.xlsx'],
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	}
] as const

export type TabularFormat = (typeof TABULAR_FORMATS)[number]['format']

// The largest file a user can upload.
export const MAX_FILE_BYTES = 1_000_000

// The <input accept> value: every extension and MIME type above.
export const TABULAR_ACCEPT = TABULAR_FORMATS.flatMap((entry) => [
	...entry.extensions,
	entry.mimeType
]).join(',')

// The format a file name's extension says it is, if PairSight reads it.
export function tabularFormatOf(fileName: string): TabularFormat | null {
	const name = fileName.toLowerCase()
	return (
		TABULAR_FORMATS.find((entry) => entry.extensions.some((extension) => name.endsWith(extension)))
			?.format ?? null
	)
}
