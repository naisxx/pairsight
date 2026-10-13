import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guessCountry } from './country-guess'

const times = <T,>(count: number, make: (index: number) => T): T[] =>
	Array.from({ length: count }, (_, index) => make(index))

test('UK postcodes make a UK file', () => {
	const guess = guessCountry(
		times(20, (i) => ({ postcode: `EC${i % 9} 8TH`, phone: '020 496 0055' }))
	)
	assert.deepEqual(guess, { code: 'GB', from: ['postcode'] })
})

test('international phone numbers, country domains and a country column all count', () => {
	const records = [
		...times(6, () => ({ phone: '+353 1 555 0100' })),
		...times(4, () => ({ email: 'ann@example.ie' })),
		...times(4, () => ({ website: 'https://shop.example.ie/about' })),
		...times(4, () => ({ country: 'Ireland' }))
	]
	assert.deepEqual(guessCountry(records), { code: 'IE', from: ['country', 'phone', 'domain'] })
})

test('a .co.uk domain is the UK; vanity domains like .io are not a country', () => {
	assert.equal(guessCountry(times(12, () => ({ email: 'sales@shop.co.uk' })))?.code, 'GB')
	assert.equal(guessCountry(times(12, () => ({ website: 'tool.io' }))), null)
})

test('too little to go on, or no clear winner: no guess', () => {
	assert.equal(guessCountry(times(5, () => ({ postcode: 'EC1A 1BB' }))), null)
	const split = [
		...times(10, () => ({ postcode: 'EC1A 1BB' })),
		...times(10, () => ({ postcode: 'K1A 0B1' }))
	]
	assert.equal(guessCountry(split), null)
})

test('what many countries share proves nothing: five-digit postcodes, local phone numbers', () => {
	assert.equal(guessCountry(times(30, () => ({ postcode: '10115', phone: '030 1234567' }))), null)
	assert.equal(guessCountry(times(12, () => ({ postcode: '94105-1804' })))?.code, 'US')
})
