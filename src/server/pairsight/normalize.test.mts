import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	normalizeCode,
	normalizeCompanyName,
	normalizeEmail,
	normalizeGtin,
	normalizePhone,
	normalizePostcode,
	normalizeText,
	normalizeWebsite
} from './normalize'

test('email is trimmed and lowercased, keeping dots and +tags', () => {
	assert.equal(normalizeEmail('  Jane.Smith+crm@Mail.COM '), 'jane.smith+crm@mail.com')
	assert.equal(normalizeEmail('   '), null)
})

test('phone normalizes to E.164 using the country, and unusable numbers give no key', () => {
	assert.equal(normalizePhone('(415) 555-0101', 'US'), '+14155550101')
	assert.equal(normalizePhone('+1 415 555 0101', 'GB'), '+14155550101')
	assert.equal(normalizePhone('020 7946 0018', 'gb'), '+442079460018')
	assert.equal(normalizePhone('12', 'US'), null)
	assert.equal(normalizePhone('4155550101', 'ZZ'), null)
	assert.equal(normalizePhone('', 'US'), null)
})

test('names collapse whitespace and case; postcodes drop spaces', () => {
	assert.equal(normalizeText('  Jane   SMITH '), 'jane smith')
	assert.equal(normalizePostcode(' sw1a 1aa '), 'SW1A1AA')
})

test('organisation names drop punctuation and a trailing legal form, never the whole name', () => {
	assert.equal(normalizeCompanyName('Acme Ltd.'), 'acme')
	assert.equal(normalizeCompanyName('ACME LIMITED'), 'acme')
	assert.equal(normalizeCompanyName('Smith & Co'), 'smith and')
	assert.equal(normalizeCompanyName('Müller GmbH'), 'müller')
	assert.equal(normalizeCompanyName('Inc'), 'inc')
	assert.equal(normalizeCompanyName('  '), null)
})

test('websites compare by host', () => {
	assert.equal(normalizeWebsite('https://www.Acme.test/about?x=1'), 'acme.test')
	assert.equal(normalizeWebsite('acme.test'), 'acme.test')
	assert.equal(normalizeWebsite('http://shop.acme.test:8080'), 'shop.acme.test')
	assert.equal(normalizeWebsite(''), null)
})

test('barcodes become 14 digits when valid, and codes keep letters and digits only', () => {
	assert.equal(normalizeGtin('0 12345 67890 5'), '00012345678905')
	assert.equal(normalizeGtin('4006381333931'), '04006381333931')
	assert.equal(normalizeGtin('4006381333932'), '4006381333932')
	assert.equal(normalizeCode('ab-123 45'), 'AB12345')
	assert.equal(normalizeCode('GB 123.4567-89'), 'GB123456789')
	assert.equal(normalizeCode('--'), null)
})
