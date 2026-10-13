'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const NOON = 12
const EVENING = 18

function stayStill() {
	return () => {}
}
const currentHour = () => new Date().getHours()
const noHourOnServer = () => null

// "Good morning, Ana" by the viewer's own clock. The server doesn't know
// their time zone, so it renders the line invisibly (keeping its space) and
// the browser fills in the right part of the day after hydration.
export function Greeting({ firstName }: { firstName: string }) {
	const t = useTranslations('Evaluations')
	const hour = useSyncExternalStore(stayStill, currentHour, noHourOnServer)
	const key =
		hour == null || hour < NOON
			? 'greetingMorning'
			: hour < EVENING
				? 'greetingAfternoon'
				: 'greetingEvening'
	return (
		<span className={hour == null ? 'invisible' : undefined}>{t(key, { name: firstName })}</span>
	)
}
