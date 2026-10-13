'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

type ShortcutSet = 'results' | 'pair'
type Shortcut = {
	keys: string[]
	label: 'move' | 'open' | 'search' | 'next' | 'previous' | 'back' | 'help'
}

// The keys each page answers to (results-keyboard.tsx, pair-keyboard.tsx).
const SHORTCUTS: Record<ShortcutSet, Shortcut[]> = {
	results: [
		{ keys: ['↑', '↓'], label: 'move' },
		{ keys: ['Enter'], label: 'open' },
		{ keys: ['/'], label: 'search' },
		{ keys: ['?'], label: 'help' }
	],
	pair: [
		{ keys: ['J'], label: 'next' },
		{ keys: ['K'], label: 'previous' },
		{ keys: ['Esc'], label: 'back' },
		{ keys: ['?'], label: 'help' }
	]
}

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	)
}

// Every keyboard shortcut on the page, in a small dialog: `?` opens it from
// anywhere but a field, and so does the hint (on Pairs, the main keys and
// `?` for the rest) for anyone who hasn't learned the `?` yet. Hidden on
// touch screens, where there are no keys.
export function ShortcutsDialog({
	set,
	showHint = false
}: {
	set: ShortcutSet
	showHint?: boolean
}) {
	const t = useTranslations('Shortcuts')
	const [isOpen, setIsOpen] = useState(false)

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return
			if (isTyping(event.target)) return
			event.preventDefault()
			setIsOpen(true)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

	return (
		<>
			{showHint && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					aria-keyshortcuts="?"
					className="text-text-muted hover:text-text inline-flex flex-wrap items-center gap-1 text-sm transition-colors duration-150 pointer-coarse:hidden"
				>
					{t.rich(set === 'results' ? 'hintKeys' : 'hint', {
						k: (chunks) => <Kbd>{chunks}</Kbd>,
						key: (chunks) => <Kbd>{chunks}</Kbd>
					})}
				</button>
			)}
			<Dialog
				open={isOpen}
				onOpenChange={setIsOpen}
				title={t('title')}
				closeLabel={t('close')}
				width="sm"
			>
				<dl className="type-ui flex flex-col gap-2.5 pb-3">
					{SHORTCUTS[set].map((shortcut) => (
						<div key={shortcut.label} className="flex items-center justify-between gap-4">
							<dt className="text-text-muted">{t(shortcut.label)}</dt>
							<dd className="flex shrink-0 items-center gap-1">
								{shortcut.keys.map((key) => (
									<Kbd key={key}>{key}</Kbd>
								))}
							</dd>
						</div>
					))}
				</dl>
			</Dialog>
		</>
	)
}
