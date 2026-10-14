// Run in the image build, after `next build` (deploy/onprem/Dockerfile):
// removes copy for pages the image doesn't build (the landing page's
// HomePage) from every messages file, so its words don't ship either. The
// type check has run by then, against the full files.
//
//   node deploy/onprem/drop-messages.mjs <messages folder> <namespace>...

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [folder, ...namespaces] = process.argv.slice(2)
if (folder == null || namespaces.length === 0) {
	console.error('Usage: node deploy/onprem/drop-messages.mjs <messages folder> <namespace>...')
	process.exit(1)
}

for (const name of readdirSync(folder).filter((file) => file.endsWith('.json'))) {
	const file = path.join(folder, name)
	const messages = JSON.parse(readFileSync(file, 'utf8'))
	for (const namespace of namespaces) {
		if (!(namespace in messages)) {
			console.error(`${file} has no ${namespace}: is the name right?`)
			process.exit(1)
		}
		delete messages[namespace]
	}
	writeFileSync(file, JSON.stringify(messages))
}
console.log(`drop-messages: ${namespaces.join(', ')} removed from ${folder}`)
