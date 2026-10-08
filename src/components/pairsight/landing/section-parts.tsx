import { cn } from '@/lib/cn'
import { ScrollReveal } from './landing-motion'

// The small coloured label above a section's heading.
export function SectionEyebrow({ children }: { children: React.ReactNode }) {
	return <p className="type-eyebrow text-accent-ink">{children}</p>
}

// A section's points as a divided list of title and text, revealed in turn:
// "Who it's for" and "Honest about what it measures".
export function PointList({
	points,
	className
}: {
	points: Array<{ key: string; id?: string; title: string; body: string }>
	className?: string
}) {
	return (
		<dl className={cn('divide-border divide-y', className)}>
			{points.map((point, index) => (
				<ScrollReveal key={point.key} index={index} className="py-6 first:pt-0 last:pb-0">
					<dt id={point.id} className="type-heading scroll-mt-28">
						{point.title}
					</dt>
					<dd className="text-text-muted mt-1.5 leading-relaxed">{point.body}</dd>
				</ScrollReveal>
			))}
		</dl>
	)
}

// A two-column section: the heading on the left, the content on the right.
export function SplitSection({
	id,
	labelledBy,
	isTinted = false,
	aside,
	children
}: {
	id: string
	labelledBy: string
	isTinted?: boolean
	aside: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<section
			id={id}
			aria-labelledby={labelledBy}
			className={cn(isTinted && 'bg-surface-muted/60 border-border border-y')}
		>
			<div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-12">
				<div className="lg:col-span-5">{aside}</div>
				<div className="lg:col-span-7">{children}</div>
			</div>
		</section>
	)
}
