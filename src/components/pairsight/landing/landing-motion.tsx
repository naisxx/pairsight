'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { startScrollScene } from './scroll-scene'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
// The class that turns on the scroll-linked styles (landing.css): without
// it, as with no script or less motion, the page shows its settled state.
const MOTION_CLASS = 'landing-motion'
const HALF = 0.5
// Smooth scrolling: how much of the way to the wheel's target the page moves
// each frame. Lower is softer.
const SCROLL_LERP = 0.1

// The landing's scroll, eased: wheel and section links glide (Lenis moves
// the window, so sticky and everything reading the scroll still work).
// Touch scrolls natively; keyboard and assistive scrolling are untouched.
function smoothScroll(): () => void {
	const lenis = new Lenis({ autoRaf: true, lerp: SCROLL_LERP })

	// A section link: glide there from where the page really is (an instant
	// jump since the last glide can leave Lenis's own idea stale), then do
	// what the link would have: update the address and move focus there.
	function onClick(event: MouseEvent) {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
		const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
		const id = link?.getAttribute('href')?.slice(1)
		const target = id ? document.getElementById(id) : null
		if (link == null || target == null) return
		event.preventDefault()
		lenis.scrollTo(window.scrollY, { immediate: true })
		lenis.scrollTo(target)
		history.pushState(null, '', `#${id}`)
		if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
		target.focus({ preventScroll: true })
	}

	document.addEventListener('click', onClick)
	return () => {
		document.removeEventListener('click', onClick)
		lenis.destroy()
	}
}

// The pointer, once a frame: the grid's glow follows it anywhere on the
// page (--cx, --cy on the grid layer), and over the hero a soft light
// follows it and the panel tilts toward it (--mx, --my, --px, --py). CSS
// variables only, so nothing re-renders.
function followPointer(root: HTMLElement): () => void {
	const grid = root.querySelector<HTMLElement>('[data-landing-grid]')
	const hero = root.querySelector<HTMLElement>('[data-landing-hero]')
	let pointer: { x: number; y: number } | null = null
	let frame = 0

	function update() {
		frame = 0
		if (pointer == null) return
		if (grid != null) {
			const box = grid.getBoundingClientRect()
			grid.style.setProperty('--cx', `${pointer.x - box.left}px`)
			grid.style.setProperty('--cy', `${pointer.y - box.top}px`)
		}
		if (hero != null) {
			const box = hero.getBoundingClientRect()
			const x = pointer.x - box.left
			const y = pointer.y - box.top
			if (x >= 0 && y >= 0 && x <= box.width && y <= box.height) {
				hero.style.setProperty('--mx', `${x}px`)
				hero.style.setProperty('--my', `${y}px`)
				hero.style.setProperty('--px', (x / box.width - HALF).toFixed(3))
				hero.style.setProperty('--py', (y / box.height - HALF).toFixed(3))
			}
		}
	}

	function onMove(event: PointerEvent) {
		pointer = { x: event.clientX, y: event.clientY }
		if (frame === 0) frame = requestAnimationFrame(update)
	}

	document.addEventListener('pointermove', onMove, { passive: true })
	return () => {
		cancelAnimationFrame(frame)
		document.removeEventListener('pointermove', onMove)
		for (const element of [grid, hero]) {
			for (const name of ['--cx', '--cy', '--mx', '--my', '--px', '--py']) {
				element?.style.removeProperty(name)
			}
		}
	}
}

// Everything on the landing that moves with the pointer or the scroll
// (pairsight-handoff Motion). Load and looping animations are CSS alone.
// Under prefers-reduced-motion none of this starts, and it stops if the
// setting changes.
export function LandingMotion() {
	useEffect(() => {
		const root = document.querySelector<HTMLElement>('[data-landing]')
		if (root == null) return
		const reduced = window.matchMedia(REDUCED_MOTION)
		let stop: Array<() => void> = []

		function apply() {
			for (const each of stop) each()
			stop = []
			if (root == null) return
			if (reduced.matches) {
				root.classList.remove(MOTION_CLASS)
				return
			}
			root.classList.add(MOTION_CLASS)
			stop = [smoothScroll(), followPointer(root), startScrollScene(root)]
		}

		apply()
		reduced.addEventListener('change', apply)
		return () => {
			reduced.removeEventListener('change', apply)
			for (const each of stop) each()
			root.classList.remove(MOTION_CLASS)
		}
	}, [])
	return null
}
