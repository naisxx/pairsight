import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { IdentityRole } from '@/lib/pairsight/entity-types'
import type { FieldComparison } from './compare'
import { keyFields } from './key-fields'

function field(role: IdentityRole, a: string, b: string): FieldComparison {
	return {
		role,
		header: role,
		a,
		b,
		comparison: a === '' || b === '' ? 'oneMissing' : a === b ? 'same' : 'different',
		isFormatOnly: false
	}
}

const fields = [
	field('product_name', 'Vamo Pro Blender', 'VAMO PRO BLENDER'),
	field('brand', 'Lumenia', 'Lumenia'),
	field('manufacturer', 'Rite Group', ''),
	field('gtin', '5035271244827', '5035271244827'),
	field('mpn', '', ''),
	field('color', 'Red', 'Red'),
	field('size', '1 L', '1.5 L')
]
const sent = ['product_name', 'brand', 'manufacturer', 'gtin', 'mpn', 'color', 'size']

test('matching values come first, strongest identifiers first', () => {
	assert.deepEqual(
		keyFields(fields, sent, 3).map((each) => each.role),
		['gtin', 'brand', 'color']
	)
})

test('the strongest differences fill in when few values match', () => {
	assert.deepEqual(
		keyFields(fields, sent, 5).map((each) => each.role),
		['gtin', 'brand', 'color', 'product_name', 'size']
	)
})

test('missing values and fields Jev never saw are left out', () => {
	const shown = keyFields(fields, ['gtin', 'manufacturer', 'mpn'], 3).map((each) => each.role)
	assert.deepEqual(shown, ['gtin'])
})
