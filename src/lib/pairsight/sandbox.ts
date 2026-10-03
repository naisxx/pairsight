import type { EntityType } from './entity-types'

// The public sandbox: three prepared evaluations on fictional data — people,
// organisations and products — that anyone can browse read-only at
// /sandbox/<id>. Fixed ids (sandbox-snapshot.ts), so `pnpm demo:seed`
// recreates the same rows every time and the URLs never change.

export const SANDBOX_EVALUATION_IDS: Record<EntityType, string> = {
	person: '5a4db0c0-0000-4000-8000-000000000001',
	company: '5a4db0c0-0000-4000-9000-000000000001',
	product: '5a4db0c0-0000-4000-a000-000000000001'
}

export const SANDBOX_BASE = '/sandbox'
