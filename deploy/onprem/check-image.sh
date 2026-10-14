#!/bin/sh
# Run in the image build, last (deploy/onprem/Dockerfile): fails it if the
# app ships what it mustn't (docs/PairSight-OnPrem.md, "What the image
# ships"):
# - our source or a way back to it: TypeScript or Python source outside
#   node_modules, or a source map or map comment anywhere. Packages' own
#   files are theirs (some, like effect, publish their TypeScript), but no
#   map of any kind ships;
# - the marketing site: the landing page, the demo's routes, its data, or
#   the landing page's copy. Found by markers only they carry.
set -eu
cd /app

found=$({
	find . -type f -name '*.map'
	find . -name node_modules -prune -o -type f \( -name '*.py' -o -name '*.ts' \
		-o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' \) -print
})
mapped=$(grep -rlE --include='*.js' --include='*.mjs' --include='*.cjs' \
	'^//# sourceMappingURL=' . 2>/dev/null || true)

# The landing page's backdrop, the products demo's name, the landing
# page's copy, the demo's routes and its files.
marketing=$({
	grep -rlF -e 'landing-grid' -e 'Product catalogue — vendor check' .next 2>/dev/null || true
	grep -lF '"HomePage"' messages/*.json 2>/dev/null || true
	find .next/server/app -path '*sandbox*' -print 2>/dev/null | head -5
	[ -e prisma/demo ] && echo prisma/demo
} | head -20)

if [ -n "$found$mapped$marketing" ]; then
	echo 'The image would ship source, source maps or the marketing site:'
	printf '%s\n%s\n%s\n' "$found" "$mapped" "$marketing" | grep . | head -40
	exit 1
fi
echo 'check-image: no source, no source maps, no marketing site'
