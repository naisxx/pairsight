#!/usr/bin/env node
// A local stand-in for TypeSafe's System One API, for development without a
// key and for the e2e suite (TYPESAFE_API_BASE_URL=http://127.0.0.1:4010/v1).
// It implements the documented request/response shape
// (https://docs.typesafe.ai/api) and scores a pair with a deterministic toy
// heuristic — it is NOT Jev, and it reports its model as `jev-stub` so its
// results are never mistaken for real judgments.
//
// Scripted failures, keyed on record_1's first_name:
//   "Failcase"  -> 422 every time (a permanent failure)
//   "Flaky"     -> 529 on the first call for that pair, then a normal answer
//                  (retried within the run)
//   "Retrycase" -> 422 on the first call for that pair, then a normal answer
//                  (fails the run's attempt; a later retry succeeds)
//
// GET /calls?marker=<text> counts the calls whose request contained <text>,
// so a test can prove an action made no Jev calls for its own records even
// while other tests run in parallel.
//
// Usage: node scripts/jev-stub.mjs   (JEV_STUB_PORT, default 4010)

import { createServer } from 'node:http'

const PORT = Number(process.env.JEV_STUB_PORT ?? 4010)
const flakySeen = new Set()
const retrySeen = new Set()
// Recent request bodies for /calls; capped so a long dev session can't grow it forever.
const MAX_RECORDED_CALLS = 5_000
const recordedCalls = []

const norm = (value) => (value ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
const digits = (value) => (value ?? '').toString().replace(/\D/g, '').slice(-10)

function editDistanceAtMostOne(a, b) {
	if (a === b) return true
	if (Math.abs(a.length - b.length) > 1) return false
	let i = 0
	let j = 0
	let edits = 0
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			i++
			j++
			continue
		}
		if (++edits > 1) return false
		if (a.length > b.length) i++
		else if (b.length > a.length) j++
		else {
			i++
			j++
		}
	}
	return edits + (a.length - i) + (b.length - j) <= 1
}

function score(a, b) {
	let value = 0.1
	const both = (key) => norm(a[key]) !== '' && norm(b[key]) !== ''
	if (both('date_of_birth')) value += norm(a.date_of_birth) === norm(b.date_of_birth) ? 0.35 : -0.5
	if (both('email') && norm(a.email) === norm(b.email)) value += 0.3
	if (both('phone') && digits(a.phone) === digits(b.phone)) value += 0.15
	if (both('first_name') && norm(a.first_name) === norm(b.first_name)) value += 0.15
	if (both('last_name')) {
		if (norm(a.last_name) === norm(b.last_name)) value += 0.1
		else if (editDistanceAtMostOne(norm(a.last_name), norm(b.last_name))) value += 0.05
	}
	if (both('address') && norm(a.address) === norm(b.address)) value += 0.1
	return Math.min(0.98, Math.max(0.02, Math.round(value * 100) / 100))
}

function send(response, status, body) {
	response.writeHead(status, { 'content-type': 'application/json' })
	response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
	if (request.method === 'GET' && request.url === '/health')
		return send(response, 200, { ok: true })
	if (request.method === 'GET' && request.url?.startsWith('/calls')) {
		const marker = new URL(request.url, 'http://stub').searchParams.get('marker') ?? ''
		const count = marker === '' ? 0 : recordedCalls.filter((raw) => raw.includes(marker)).length
		return send(response, 200, { count })
	}
	if (request.method !== 'POST' || !request.url?.endsWith('/systemone')) {
		return send(response, 404, { error: 'not_found' })
	}
	if (!/^Bearer \S+/.test(request.headers.authorization ?? '')) {
		return send(response, 401, { error: 'invalid_api_key' })
	}
	let raw = ''
	request.on('data', (chunk) => (raw += chunk))
	request.on('end', () => {
		recordedCalls.push(raw)
		if (recordedCalls.length > MAX_RECORDED_CALLS) recordedCalls.shift()
		let body
		try {
			body = JSON.parse(raw)
		} catch {
			return send(response, 422, { error: 'invalid_json' })
		}
		const a = body?.state?.record_1 ?? {}
		const b = body?.state?.record_2 ?? {}
		const questionId = Object.keys(body?.questions ?? {})[0]
		if (questionId == null) return send(response, 422, { error: 'no_questions' })
		if (norm(a.first_name) === 'failcase')
			return send(response, 422, { error: 'validation_failed' })
		const pairKey = JSON.stringify([a, b])
		if (norm(a.first_name) === 'retrycase' && !retrySeen.has(pairKey)) {
			retrySeen.add(pairKey)
			return send(response, 422, { error: 'validation_failed' })
		}
		if (norm(a.first_name) === 'flaky' && !flakySeen.has(pairKey)) {
			flakySeen.add(pairKey)
			return send(response, 529, { error: 'overloaded' })
		}
		send(response, 200, {
			model: 'jev-stub',
			answers: { [questionId]: { type: 'noul', noul: score(a, b) } },
			usage: { input_tokens: Math.round(raw.length / 4), output_tokens: 1 }
		})
	})
})

server.listen(PORT, '127.0.0.1', () => {
	console.log(`Jev stub listening on http://127.0.0.1:${PORT}/v1/systemone`)
})
