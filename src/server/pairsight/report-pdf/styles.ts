import { StyleSheet } from '@react-pdf/renderer'

// The report's look. A PDF can't read the app's CSS variables, so these are
// the light theme's values from src/app/globals.css, copied: keep them in
// step when a token there changes. Helvetica is built into every PDF reader,
// so nothing has to be embedded.

export const COLORS = {
	text: '#0f1720',
	muted: '#4e5a6a',
	border: '#dde2e9',
	surfaceMuted: '#eef1f4',
	action: '#c93a22',
	brandDeep: '#972828',
	success: '#14773a',
	successSubtle: '#e8f6ee',
	danger: '#be1d4b',
	warning: '#8a5a00',
	warningSubtle: '#fcf3de'
} as const

// One colour and dash per vendor, so the chart never relies on colour alone.
export const VENDOR_SERIES = [
	{ color: '#364152', dash: undefined },
	{ color: '#c25a12', dash: '4 2' },
	{ color: '#4e5a6a', dash: '1 2' }
] as const

export const PAGE_PADDING = 40
const BASE_SIZE = 9.5
// Set on text styles, never on the page: there, react-pdf stops drawing the
// footer's page numbers. Always beside a fontSize: react-pdf multiplies it by
// the style's own size, which otherwise defaults to 18.
const LINE_HEIGHT = 1.4
const SMALL_SIZE = 8

export const styles = StyleSheet.create({
	page: {
		paddingTop: PAGE_PADDING,
		paddingBottom: PAGE_PADDING + 16,
		paddingHorizontal: PAGE_PADDING,
		fontFamily: 'Helvetica',
		fontSize: BASE_SIZE,
		color: COLORS.text
	},
	bold: { fontFamily: 'Helvetica-Bold' },
	muted: { color: COLORS.muted },
	small: { fontSize: SMALL_SIZE, lineHeight: LINE_HEIGHT },
	eyebrow: {
		fontSize: SMALL_SIZE,
		color: COLORS.action,
		fontFamily: 'Helvetica-Bold',
		letterSpacing: 0.6,
		textTransform: 'uppercase'
	},
	title: { fontSize: 20, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', marginTop: 4 },
	subtitle: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
	meta: { fontSize: 8.5, color: COLORS.muted, marginTop: 8 },
	h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
	h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3 },
	paragraph: { marginBottom: 4, fontSize: BASE_SIZE, lineHeight: LINE_HEIGHT },
	verdict: {
		marginTop: 16,
		padding: 12,
		borderLeftWidth: 3,
		borderLeftColor: COLORS.action,
		backgroundColor: COLORS.surfaceMuted
	},
	verdictLead: { fontSize: 12, lineHeight: LINE_HEIGHT, marginBottom: 6 },
	banner: {
		marginTop: 12,
		padding: 8,
		backgroundColor: COLORS.warningSubtle,
		color: COLORS.warning
	},
	caveat: {
		marginTop: 14,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: COLORS.border,
		fontSize: SMALL_SIZE,
		color: COLORS.muted
	},
	table: { borderTopWidth: 1, borderTopColor: COLORS.border },
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: COLORS.border,
		paddingVertical: 4
	},
	headerRow: { fontFamily: 'Helvetica-Bold', fontSize: SMALL_SIZE, color: COLORS.muted },
	cell: { paddingRight: 6 },
	number: { textAlign: 'right' },
	bar: { height: 3, backgroundColor: COLORS.border, marginTop: 2 },
	barFill: { height: 3, backgroundColor: COLORS.text },
	card: {
		marginBottom: 8,
		padding: 8,
		borderWidth: 1,
		borderColor: COLORS.border,
		borderRadius: 3
	},
	keyValue: { flexDirection: 'row', marginBottom: 2 },
	key: { width: 120, color: COLORS.muted, fontSize: BASE_SIZE, lineHeight: LINE_HEIGHT },
	value: { flex: 1, fontSize: BASE_SIZE, lineHeight: LINE_HEIGHT },
	exampleRow: { flexDirection: 'row', fontSize: SMALL_SIZE, lineHeight: LINE_HEIGHT },
	footer: {
		position: 'absolute',
		bottom: PAGE_PADDING / 2,
		left: PAGE_PADDING,
		right: PAGE_PADDING,
		fontSize: 7.5,
		color: COLORS.muted
	},
	pageNumber: { textAlign: 'right' }
})
