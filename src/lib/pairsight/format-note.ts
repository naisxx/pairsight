// Two values that only differ in how they're written: when it's only their
// capitals ("Iamen Kettle" / "IAMEN KETTLE") the note says so; otherwise
// (spacing, punctuation, a phone number's prefix) it says they're written
// differently. For messages: Pair.formatNote.
export function formatNoteKind(a: string, b: string): 'capitals' | 'other' {
	return a !== b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
		? 'capitals'
		: 'other'
}
