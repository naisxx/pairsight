'use client'

import { InfoIcon } from './icons'
import { Tip } from './tooltip'

const ICON_SIZE = 14

// An (i) beside a label that explains it on hover or focus. `label` names
// the button for screen readers ("About precision").
export function InfoTip({ content, label }: { content: React.ReactNode; label: string }) {
	return (
		<Tip content={content}>
			<button
				type="button"
				aria-label={label}
				className="text-text-muted hover:text-text inline-flex size-5 items-center justify-center rounded-full transition-colors duration-150"
			>
				<InfoIcon size={ICON_SIZE} />
			</button>
		</Tip>
	)
}
