// A sample file to download (public/samples/, built by
// scripts/build-samples.mts): plain underlined text, saved rather than opened.
export const SAMPLE_FILES = {
	records: '/samples/pairsight-sample-records.csv',
	vendorPairs: '/samples/pairsight-sample-vendor-pairs.csv',
	vendorGroups: '/samples/pairsight-sample-vendor-groups.csv'
} as const

export function SampleLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<a
			href={href}
			download
			className="text-text decoration-border-strong hover:decoration-text underline underline-offset-[3px] transition-[text-decoration-color] duration-150"
		>
			{children}
		</a>
	)
}
