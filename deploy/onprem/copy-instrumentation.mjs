// Run in the image build, after `next build` (deploy/onprem/Dockerfile).
// Next's standalone output leaves out the compiled instrumentation, so the
// server would start without what instrumentation.ts starts: the env check,
// the outbound-services line and the run worker. Copies it into the
// standalone folder with every file its trace (the .nft.json beside it)
// says it loads.

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SERVER = '.next/server'
const STANDALONE = '.next/standalone'
const ENTRY = 'instrumentation.js'

const trace = JSON.parse(readFileSync(path.join(SERVER, `${ENTRY}.nft.json`), 'utf8'))
let copied = 0
for (const file of [ENTRY, ...trace.files]) {
	const from = path.join(SERVER, file)
	const to = path.join(STANDALONE, path.relative('.', from))
	if (existsSync(to)) continue
	mkdirSync(path.dirname(to), { recursive: true })
	cpSync(from, to, { recursive: true, dereference: false })
	copied += 1
}
console.log(`instrumentation: copied ${copied} of ${trace.files.length + 1} traced files`)
