import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Every word on screen is plain English for an analyst new to record
// matching (docs/rules/copy.md). These are the words that page retired: the
// jargon, the second names for one thing, and anything only a developer
// could act on. Placeholders ({threshold}) are code, not copy, so they're
// stripped before reading.
const RETIRED: Array<[RegExp, string]> = [
	[/\bbuckets?\b/i, 'say "group"'],
	[/\bblocking\b/i, 'say "comparison rules"'],
	[/\bcandidates?\b/i, 'say "pairs to check"'],
	[/\bcomposite\b/i, 'say "your own rule"'],
	[/\bpresets?\b/i, 'say "suggested rules"'],
	[/\bnormali[sz]/i, 'say what was tidied up'],
	[/\bassess/i, 'say "check"'],
	[/\bharmonic\b/i, 'say "balances the two"'],
	[/\b(evaluated|planned) pairs?\b/i, 'say "checked pairs" or "pairs"'],
	[/\bfuzzy\b/i, 'say "close match"'],
	[/\brecord references?\b/i, 'say "record ID"'],
	[/\b(pair|group) format\b/i, 'say "a list of pairs / groups"'],
	[/\bPairSight (only|match|matches|decision|threshold)\b/i, 'Jev is the judge, not PairSight'],
	[/\bvendor only\b/i, 'say "only vendor says same"'],
	[/\bthreshold\b/i, 'say "match cut-off"'],
	[/\b(precision|recall|F1)\b/, 'plain words first; the technical name only in a tip'],
	[/TYPESAFE_|\bpnpm\b|\.env\b|API key/, 'developer-only: say what to do instead'],
	[/[≥±∅]/, 'write it in words']
]

// Where a retired word is the point: the tips and report notes that give
// precision, recall and F1 their technical names for analysts who know them.
const ALLOWED = new Set([
	'Overview.precisionTip',
	'Overview.recallTip',
	'Overview.f1Tip',
	'Report.precisionMeaning',
	'Report.recallMeaning',
	'Report.f1Meaning'
])

const PLACEHOLDER = /\{\s*[A-Za-z0-9_]+\s*(?=[,}])/g

function strings(node: unknown, at: string, out: Array<[string, string]>) {
	if (typeof node === 'string') out.push([at, node])
	else if (node != null && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			strings(value, at === '' ? key : `${at}.${key}`, out)
		}
	}
	return out
}

export function retiredWords(messages: unknown): string[] {
	const found: string[] = []
	for (const [key, text] of strings(messages, '', [])) {
		if (ALLOWED.has(key)) continue
		const copy = text.replace(PLACEHOLDER, '{')
		for (const [word, instead] of RETIRED) {
			const hit = word.exec(copy)
			if (hit != null) found.push(`${key}: “${hit[0]}” (${instead})`)
		}
	}
	return found
}

test('the copy uses plain words: no retired jargon on screen', () => {
	const messages: unknown = JSON.parse(
		readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf8')
	)
	assert.deepEqual(retiredWords(messages), [])
})

test('the check catches a retired word, and reads past placeholders', () => {
	assert.deepEqual(retiredWords({ Rules: { stat: 'Largest bucket' } }), [
		'Rules.stat: “bucket” (say "group")'
	])
	assert.deepEqual(retiredWords({ Plan: { note: 'Cut-off {threshold, number}' } }), [])
	assert.deepEqual(retiredWords({ Overview: { precisionTip: 'Also called precision.' } }), [])
})
