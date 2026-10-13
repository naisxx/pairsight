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
// POST /reject?marker=<text>[&status=403] answers 401 (a rejected API key),
// or the status given, to every call containing <text> until
// POST /accept?marker=<text>, so a test can stop its own run with a
// configuration error and then resume it.
//
// A request whose key is REFUSED_KEY gets 401, as Jev answers a wrong key,
// so Settings' key check can be tested. GET /keys?marker=<text> lists the
// last four characters of every key used on calls containing <text>, so a
// test can prove a run used the key saved in Settings.
//
// POST /slow?marker=<text> delays every answer to a call containing <text>
// by a few seconds until POST /fast?marker=<text>, so a test can
// catch its own run part-way (to pause it) on a stub that's otherwise
// instant.
//
// Jev's bad days, per marker, each until POST /calm?marker=<text>:
//   POST /busy?marker=&status=429&retryAfter=2&count=6
//        answers `status` (with Retry-After seconds, if given) to the next
//        `count` calls (every call, without a count)
//   POST /outage?marker=&seconds=10
//        every call fails for that long: 529, 503 and a dropped connection,
//        in turn
//   POST /hang?marker=&count=1   the next `count` calls never get an answer
//   POST /garbage?marker=&count=1   a 200 whose body isn't JSON
//
// Usage: node scripts/jev-stub.mjs   (JEV_STUB_PORT, default 4010)

import { createServer } from 'node:http'

const PORT = Number(process.env.JEV_STUB_PORT ?? 4010)
const flakySeen = new Set()
const retrySeen = new Set()
// Recent request bodies for /calls; capped so a long dev session can't grow it forever.
const MAX_RECORDED_CALLS = 5_000
const recordedCalls = []
const REFUSED_KEY = 'e2e-refused-key'
const KEY_TAIL = 4
// marker -> the status a call containing it gets (401 or 403).
const rejectedMarkers = new Map()
// marker -> { kind, status?, retryAfter?, remaining?, until? } (see above).
const troubles = new Map()
const OUTAGE_STATUSES = [529, 503, 'drop']
const slowMarkers = new Set()
// How long a slowed answer waits. The worker checks a run's pairs at once,
// so this is about how long a slowed run takes: long enough for another tab
// to see it running, short enough for a paused one to settle in a test.
const SLOW_ANSWER_MS = 6_000

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

const LEGAL_FORM = /\s+(ltd|limited|inc|llc|plc|gmbh|corp|corporation|co)\.?$/
const companyName = (value) => norm(value).replace(/[.,]/g, '').replace(LEGAL_FORM, '')
const host = (value) =>
	norm(value)
		.replace(/^[a-z]+:\/\//, '')
		.replace(/^www\./, '')
		.split('/')[0]
const code = (value) => norm(value).replace(/[^a-z0-9]/g, '')

// Organisations: the same registration or website says same; a different
// registration says different. Roughly what the live check showed.
function scoreCompany(a, b) {
	let value = 0.1
	const both = (key) => norm(a[key]) !== '' && norm(b[key]) !== ''
	if (both('registration_number'))
		value += code(a.registration_number) === code(b.registration_number) ? 0.45 : -0.5
	if (both('website') && host(a.website) === host(b.website)) value += 0.35
	if (both('company_name') && companyName(a.company_name) === companyName(b.company_name))
		value += 0.35
	if (both('phone') && digits(a.phone) === digits(b.phone)) value += 0.1
	if (both('city') && norm(a.city) === norm(b.city)) value += 0.05
	return Math.min(0.98, Math.max(0.02, Math.round(value * 100) / 100))
}

// Products: one barcode or part number says same; another size, colour or
// brand says different.
function scoreProduct(a, b) {
	let value = 0.1
	const both = (key) => norm(a[key]) !== '' && norm(b[key]) !== ''
	if (both('gtin'))
		value += code(a.gtin).padStart(14, '0') === code(b.gtin).padStart(14, '0') ? 0.6 : -0.5
	if (both('mpn') && code(a.mpn) === code(b.mpn)) value += 0.35
	if (both('sku') && code(a.sku) === code(b.sku)) value += 0.3
	if (both('brand')) value += norm(a.brand) === norm(b.brand) ? 0.1 : -0.4
	if (both('product_name') && norm(a.product_name) === norm(b.product_name)) value += 0.2
	for (const variant of ['size', 'color']) {
		if (both(variant) && norm(a[variant]) !== norm(b[variant])) value -= 0.5
	}
	return Math.min(0.98, Math.max(0.02, Math.round(value * 100) / 100))
}

// The question id says what the records are (src/lib/pairsight/entity-types.ts).
function scoreFor(questionId, a, b) {
	if (questionId === 'same_organisation') return scoreCompany(a, b)
	if (questionId === 'same_product') return scoreProduct(a, b)
	return score(a, b)
}

function send(response, status, body) {
	response.writeHead(status, { 'content-type': 'application/json' })
	response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
	if (request.method === 'GET' && request.url === '/health')
		return send(response, 200, { ok: true })
	if (request.method === 'POST' && /^\/(reject|accept)\?/.test(request.url ?? '')) {
		const url = new URL(request.url ?? '', 'http://stub')
		const marker = url.searchParams.get('marker') ?? ''
		if (marker === '') return send(response, 400, { error: 'marker_required' })
		if (url.pathname === '/reject') {
			rejectedMarkers.set(marker, Number(url.searchParams.get('status') ?? 401))
		} else rejectedMarkers.delete(marker)
		return send(response, 200, { rejected: rejectedMarkers.has(marker) })
	}
	if (request.method === 'POST' && /^\/(busy|outage|hang|garbage|calm)\?/.test(request.url ?? '')) {
		const url = new URL(request.url ?? '', 'http://stub')
		const marker = url.searchParams.get('marker') ?? ''
		if (marker === '') return send(response, 400, { error: 'marker_required' })
		const kind = url.pathname.slice(1)
		if (kind === 'calm') {
			troubles.delete(marker)
			return send(response, 200, { calm: true })
		}
		const count = url.searchParams.get('count')
		const seconds = Number(url.searchParams.get('seconds') ?? 0)
		troubles.set(marker, {
			kind,
			status: Number(url.searchParams.get('status') ?? 429),
			retryAfter: url.searchParams.get('retryAfter'),
			remaining:
				count == null ? (kind === 'busy' || kind === 'outage' ? Infinity : 1) : Number(count),
			until: kind === 'outage' ? Date.now() + seconds * 1_000 : Infinity,
			turn: 0
		})
		return send(response, 200, { [kind]: true })
	}
	if (request.method === 'POST' && /^\/(slow|fast)\?/.test(request.url ?? '')) {
		const url = new URL(request.url ?? '', 'http://stub')
		const marker = url.searchParams.get('marker') ?? ''
		if (marker === '') return send(response, 400, { error: 'marker_required' })
		if (url.pathname === '/slow') slowMarkers.add(marker)
		else slowMarkers.delete(marker)
		return send(response, 200, { slow: slowMarkers.has(marker) })
	}
	if (request.method === 'GET' && request.url?.startsWith('/calls')) {
		const marker = new URL(request.url, 'http://stub').searchParams.get('marker') ?? ''
		const count = marker === '' ? 0 : recordedCalls.filter(({ raw }) => raw.includes(marker)).length
		return send(response, 200, { count })
	}
	if (request.method === 'GET' && request.url?.startsWith('/keys')) {
		const marker = new URL(request.url, 'http://stub').searchParams.get('marker') ?? ''
		const keys = new Set(
			recordedCalls.filter(({ raw }) => marker !== '' && raw.includes(marker)).map(({ key }) => key)
		)
		return send(response, 200, { keys: [...keys] })
	}
	if (request.method !== 'POST' || !request.url?.endsWith('/systemone')) {
		return send(response, 404, { error: 'not_found' })
	}
	const key = /^Bearer (\S+)/.exec(request.headers.authorization ?? '')?.[1]
	if (key == null || key === REFUSED_KEY) {
		return send(response, 401, { error: 'invalid_api_key' })
	}
	const keyTail = key.slice(-KEY_TAIL)
	let raw = ''
	request.on('data', (chunk) => (raw += chunk))
	request.on('end', () => {
		if (troubled(raw, keyTail, request, response)) return
		const isSlow = [...slowMarkers].some((marker) => raw.includes(marker))
		if (isSlow) setTimeout(() => answer(raw, keyTail, response), SLOW_ANSWER_MS)
		else answer(raw, keyTail, response)
	})
})

function record(raw, key) {
	recordedCalls.push({ raw, key })
	if (recordedCalls.length > MAX_RECORDED_CALLS) recordedCalls.shift()
}

// A bad day for this call's marker, if it has one: answers (or doesn't) and
// returns true.
function troubled(raw, key, request, response) {
	const entry = [...troubles].find(([marker]) => raw.includes(marker))
	if (entry == null) return false
	const [marker, trouble] = entry
	if (trouble.remaining <= 0 || Date.now() >= trouble.until) {
		troubles.delete(marker)
		return false
	}
	trouble.remaining--
	record(raw, key)
	if (trouble.kind === 'hang') return true
	if (trouble.kind === 'garbage') {
		response.writeHead(200, { 'content-type': 'text/html' })
		response.end('<html>Bad gateway</html>')
		return true
	}
	if (trouble.kind === 'outage') {
		const status = OUTAGE_STATUSES[trouble.turn++ % OUTAGE_STATUSES.length]
		if (status === 'drop') request.socket.destroy()
		else send(response, status, { error: 'overloaded' })
		return true
	}
	const headers = { 'content-type': 'application/json' }
	if (trouble.retryAfter != null) headers['retry-after'] = trouble.retryAfter
	response.writeHead(trouble.status, headers)
	response.end(JSON.stringify({ error: 'rate_limited' }))
	return true
}

// Answers one judgment request (after the slow delay, if any).
function answer(raw, key, response) {
	record(raw, key)
	const rejected = [...rejectedMarkers].find(([marker]) => raw.includes(marker))
	if (rejected != null) {
		return send(response, rejected[1], { error: 'invalid_api_key' })
	}
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
	if (norm(a.first_name) === 'failcase') return send(response, 422, { error: 'validation_failed' })
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
		answers: { [questionId]: { type: 'noul', noul: scoreFor(questionId, a, b) } },
		usage: { input_tokens: Math.round(raw.length / 4), output_tokens: 1 }
	})
}

server.listen(PORT, '127.0.0.1', () => {
	console.log(`Jev stub listening on http://127.0.0.1:${PORT}/v1/systemone`)
})
