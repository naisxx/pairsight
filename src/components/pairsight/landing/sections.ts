// The landing's sections, in page order: their anchors and the nav's names
// for them (messages: HomePage).
export const LANDING_SECTIONS = [
	{ id: 'how', label: 'navHow' },
	{ id: 'look', label: 'navLook' },
	{ id: 'who', label: 'navWho' },
	{ id: 'honest', label: 'navHonest' },
	{ id: 'faq', label: 'navFaq' }
] as const

// The demo pair the hero opens on and the story follows: first and last
// names swapped, the same date of birth, another email and address.
// PairSight suggested it, Jev calls it the same, and both vendors missed it.
export const STORY_PAIR = 'P001497-P001496'
