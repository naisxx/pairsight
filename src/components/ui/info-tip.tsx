'use client'

import { useRef, useState } from 'react'
import { InfoIcon } from './icons'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const ICON_SIZE = 14

// An (i) beside a label that explains it. Hover or keyboard focus shows it,
// as a tip; a tap or click toggles it too, so it also opens on a phone,
// where there's no hover. `label` names the button for screen readers
// ("About precision"). The icon stays small; its hit area is 44px on touch.
export function InfoTip({ content, label }: { content: React.ReactNode; label: string }) {
	const [isOpen, setIsOpen] = useState(false)
	// The tip closes itself as the pointer goes down; remember whether it was
	// open before that, so the click that follows can toggle it.
	const wasOpen = useRef(false)
	return (
		<Tooltip open={isOpen} onOpenChange={setIsOpen}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					onPointerDown={() => {
						wasOpen.current = isOpen
					}}
					onClick={() => setIsOpen(!wasOpen.current)}
					className="hit-area text-text-muted hover:text-text inline-flex size-5 items-center justify-center rounded-full transition-colors duration-150"
				>
					<InfoIcon size={ICON_SIZE} />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">{content}</TooltipContent>
		</Tooltip>
	)
}
