'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShell } from './shell-frame'

const TIP_OFFSET_PX = 10

// Names an icon-only control while the sidebar is collapsed; when it's
// expanded the label is visible, so there's no tooltip.
export function SidebarTip({ label, children }: { label: string; children: React.ReactElement }) {
	const { isCollapsed } = useShell()
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			{isCollapsed && (
				<TooltipContent side="right" sideOffset={TIP_OFFSET_PX} className="hidden md:block">
					{label}
				</TooltipContent>
			)}
		</Tooltip>
	)
}
