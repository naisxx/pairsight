// The name a run's downloads share: pairsight-<evaluation>-run-<n>-<kind><ext>,
// with the evaluation's name reduced to a safe, short slug.

const MAX_SLUG_LENGTH = 40

function slug(name: string): string {
	const cleaned = name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LENGTH)
	return cleaned === '' ? 'evaluation' : cleaned
}

export function exportFileName({
	evaluation,
	runNumber,
	kind,
	extension
}: {
	evaluation: string
	runNumber: number
	kind: 'findings' | 'summary'
	extension: string
}): string {
	return `pairsight-${slug(evaluation)}-run-${runNumber}-${kind}${extension}`
}
