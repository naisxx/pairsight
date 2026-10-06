import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Every count on screen is written one way (src/i18n/formats.ts): 999, 1.2K,
// 1.23M. In messages that means `{count, number, compact}`. A count a message
// pluralises on is a number for sure, so it may never be shown any other
// way: not as `#`, not bare as `{count}`, not as `{count, number}`.

type Argument = { name: string; kind: string | null; style: string | null }

// The arguments a message shows and the `#`s in it, reading plural and
// select branches as text, not as arguments.
function scan(text: string): { args: Argument[]; plurals: Set<string>; pounds: number } {
	const args: Argument[] = []
	const plurals = new Set<string>()
	let pounds = 0
	// 'choice': inside a plural or select, whose children are branches.
	const stack: Array<'choice' | 'branch' | 'other'> = []
	const head = /^\{\s*(\w+)\s*(?:,\s*(\w+)\s*(?:,\s*(\w+)\s*)?)?([},])/
	for (let index = 0; index < text.length; index++) {
		const char = text[index]
		if (char === '{') {
			if (stack.at(-1) === 'choice') {
				stack.push('branch')
				continue
			}
			const match = head.exec(text.slice(index))
			if (match != null) {
				const [whole, name = '', kind = null, style = null, end] = match
				if (kind === 'plural' || kind === 'select' || kind === 'selectordinal') {
					if (kind === 'plural') plurals.add(name)
					stack.push('choice')
					continue
				}
				args.push({ name, kind, style })
				if (end === '}') {
					index += whole.length - 1
					continue
				}
			}
			stack.push('other')
		} else if (char === '}') stack.pop()
		else if (char === '#' && stack.includes('choice')) pounds++
	}
	return { args, plurals, pounds }
}

function strings(node: unknown, at: string, out: Array<[string, string]>) {
	if (typeof node === 'string') out.push([at, node])
	else if (node != null && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			strings(value, at === '' ? key : `${at}.${key}`, out)
		}
	}
	return out
}

export function uncompactedCounts(messages: unknown): string[] {
	const found: string[] = []
	for (const [key, text] of strings(messages, '', [])) {
		const { args, plurals, pounds } = scan(text)
		if (pounds > 0) found.push(`${key}: “#” (write {count, number, compact})`)
		for (const { name, kind, style } of args) {
			if (kind === 'number' && style !== 'compact') {
				found.push(`${key}: {${name}, number} (write {${name}, number, compact})`)
			} else if (kind == null && plurals.has(name)) {
				found.push(`${key}: {${name}} (write {${name}, number, compact})`)
			}
		}
	}
	return found
}

test('every count in the copy is written compact', () => {
	const messages: unknown = JSON.parse(
		readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf8')
	)
	assert.deepEqual(uncompactedCounts(messages), [])
})

test('the check catches each way a count skips the format, and reads branches as text', () => {
	assert.deepEqual(
		uncompactedCounts({
			A: { pound: '{count, plural, one {# pair} other {# pairs}}' },
			B: { bare: '{rows} {rows, plural, one {row} other {rows}}' },
			C: { number: '{total, number} pairs' }
		}),
		[
			'A.pound: “#” (write {count, number, compact})',
			'B.bare: {rows} (write {rows, number, compact})',
			'C.number: {total, number} (write {total, number, compact})'
		]
	)
	assert.deepEqual(
		uncompactedCounts({
			ok: { line: '{rows, number, compact} {rows, plural, one {row} other {rows}}' }
		}),
		[]
	)
})
