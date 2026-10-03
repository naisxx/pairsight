'use client'

import { useSyncExternalStore } from 'react'
import {
	parseUiStyle,
	UI_STYLE_ATTRIBUTE,
	UI_STYLE_COOKIE,
	UI_STYLE_MAX_AGE_SECONDS,
	type UiStyle
} from '@/lib/ui-style'

const CHANGE_EVENT = 'ui-style-change'

function subscribe(onChange: () => void) {
	window.addEventListener(CHANGE_EVENT, onChange)
	return () => window.removeEventListener(CHANGE_EVENT, onChange)
}
const read = (): UiStyle => parseUiStyle(document.documentElement.getAttribute(UI_STYLE_ATTRIBUTE))
const readOnServer = (): UiStyle => 'classic'

// The UI style on <html>, and a setter that switches it at once and keeps it
// in the cookie the server reads (src/lib/ui-style.ts).
export function useUiStyle(): [UiStyle, (style: UiStyle) => void] {
	const style = useSyncExternalStore(subscribe, read, readOnServer)
	function setStyle(next: UiStyle) {
		document.documentElement.setAttribute(UI_STYLE_ATTRIBUTE, next)
		document.cookie = `${UI_STYLE_COOKIE}=${next}; path=/; max-age=${UI_STYLE_MAX_AGE_SECONDS}; samesite=lax`
		window.dispatchEvent(new Event(CHANGE_EVENT))
	}
	return [style, setStyle]
}
