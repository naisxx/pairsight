// Adds nothing to the page: it's here so the demo's own not-found.tsx can
// catch a missing evaluation from [id]/layout.tsx. A layout's notFound() is
// handled by the boundary its parent's layout mounts, and without one here
// the app-wide page would answer instead.
export default function SandboxLayout({ children }: { children: React.ReactNode }) {
	return children
}
