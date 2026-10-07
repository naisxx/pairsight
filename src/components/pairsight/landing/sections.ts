// The landing's sections, in page order: their anchors and the nav's names
// for them (messages: HomePage).
export const LANDING_SECTIONS = [
	{ id: 'how', label: 'navHow' },
	{ id: 'look', label: 'navLook' },
	{ id: 'who', label: 'navWho' },
	{ id: 'honest', label: 'navHonest' },
	{ id: 'faq', label: 'navFaq' }
] as const

// The demo pair the hero opens on and the story follows: a duplicate Jev
// calls the same and both vendors missed.
export const STORY_PAIR = 'R01-R03'
