// Run in the image build (deploy/onprem/Dockerfile) on each folder the image
// ships: removes every source map, and the comments pointing at them
// (inline data: maps among them), so the image carries no way back to the
// source. check-image.sh then fails the build if any got back in.
//
//   node deploy/onprem/strip-source-maps.mjs <folder>...

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const MAP_COMMENT = /^\/\/# sourceMappingURL=.*$/gm
const SCRIPT = /\.(c|m)?js$/

function* filesUnder(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) yield* filesUnder(full)
		else if (entry.isFile()) yield full
	}
}

const folders = process.argv.slice(2)
if (folders.length === 0) {
	console.error('Usage: node deploy/onprem/strip-source-maps.mjs <folder>...')
	process.exit(1)
}

let maps = 0
let comments = 0
for (const folder of folders) {
	for (const file of filesUnder(folder)) {
		if (file.endsWith('.map')) {
			rmSync(file)
			maps += 1
		} else if (SCRIPT.test(file)) {
			const code = readFileSync(file, 'utf8')
			const stripped = code.replace(MAP_COMMENT, '')
			if (stripped === code) continue
			writeFileSync(file, stripped)
			comments += 1
		}
	}
}
console.log(
	`strip-source-maps: ${maps} maps and ${comments} map comments removed from ${folders.join(', ')}`
)
