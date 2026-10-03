// The UI style: Classic (solid surfaces) or Glass (frosted, translucent
// surfaces over a soft colour backdrop; src/app/glass.css). Chosen in the
// Theme menu, kept in a cookie so the server puts it on <html> and the first
// paint is already right, like the light/dark theme.

export const UI_STYLES = ['classic', 'glass'] as const
export type UiStyle = (typeof UI_STYLES)[number]
export const UI_STYLE_COOKIE = 'ui-style'
export const UI_STYLE_ATTRIBUTE = 'data-ui'
export const UI_STYLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function parseUiStyle(value: string | null | undefined): UiStyle {
	return UI_STYLES.find((style) => style === value) ?? 'classic'
}
