import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	detectEntityType,
	normalizeHeader,
	suggestFields,
	suggestReferenceColumn
} from './field-dictionary'
import type { EntityType, IdentityRole } from './entity-types'

// What one column name alone suggests for a type (null: nothing).
function roleOf(header: string, type: EntityType): IdentityRole | null {
	return suggestFields({ headers: [header], rows: [], type }).get(header)?.role ?? null
}

test('column names are read as plain words', () => {
	assert.equal(normalizeHeader('FirstName'), 'first name')
	assert.equal(normalizeHeader('BillingPostalCode'), 'billing postal code')
	assert.equal(normalizeHeader('EMAIL_ADDRESS'), 'email address')
	assert.equal(normalizeHeader('Phone1'), 'phone 1')
	assert.equal(normalizeHeader('  Date of Birth (DOB) '), 'date of birth dob')
	assert.equal(normalizeHeader('Société'), 'societe')
	assert.equal(normalizeHeader('GTIN-14'), 'gtin 14')
})

const PEOPLE: Array<[string, IdentityRole | null]> = [
	['First Name', 'first_name'],
	['firstname', 'first_name'],
	['FirstName', 'first_name'],
	['given_name', 'first_name'],
	['Forename', 'first_name'],
	['fname', 'first_name'],
	['Last Name', 'last_name'],
	['LastName', 'last_name'],
	['surname', 'last_name'],
	['Family name', 'last_name'],
	['Full Name', 'full_name'],
	['Name', 'full_name'],
	['Customer Name', 'full_name'],
	['Contact Name', 'full_name'],
	['Email', 'email'],
	['E-mail', 'email'],
	['EmailAddress', 'email'],
	['Primary Email Address', 'email'],
	['Customer Email', 'email'],
	['emailaddress1', 'email'],
	['Phone', 'phone'],
	['Phone Number', 'phone'],
	['MobilePhone', 'phone'],
	['Mobile', 'phone'],
	['Cell phone', 'phone'],
	['Tel.', 'phone'],
	['Home Phone', 'phone'],
	['Date of Birth', 'date_of_birth'],
	['DOB', 'date_of_birth'],
	['Birthdate', 'date_of_birth'],
	['birth_date', 'date_of_birth'],
	['Address', 'address'],
	['Street Address', 'address'],
	['Address Line 1', 'address'],
	['address1', 'address'],
	['MailingStreet', 'address'],
	['City', 'city'],
	['Town', 'city'],
	['Billing City', 'city'],
	['Postcode', 'postcode'],
	['Zip', 'postcode'],
	['ZIP Code', 'postcode'],
	['Postal Code', 'postcode'],
	['BillingPostalCode', 'postcode'],
	['Country', 'country'],
	['Country Code', 'country'],
	// Never part of a word, never a vague word inside a longer name.
	['Hotel', null],
	['Ethnicity', null],
	['Last updated', null],
	['Record type', null],
	['Notes', null],
	['Created at', null]
]

test('people: common column names map to their field', () => {
	for (const [header, role] of PEOPLE) {
		assert.equal(roleOf(header, 'person'), role, header)
	}
})

const COMPANIES: Array<[string, IdentityRole | null]> = [
	['Company', 'company_name'],
	['Company Name', 'company_name'],
	['Account Name', 'company_name'],
	['Organisation', 'company_name'],
	['Organization Name', 'company_name'],
	['Legal Name', 'company_name'],
	['Business Name', 'company_name'],
	['Name', 'company_name'],
	['Name1', 'company_name'],
	['Trading Name', 'trading_name'],
	['DBA', 'trading_name'],
	['Doing Business As', 'trading_name'],
	['Company Number', 'registration_number'],
	['Registration No', 'registration_number'],
	['CRN', 'registration_number'],
	['DUNS Number', 'registration_number'],
	['LEI', 'registration_number'],
	['VAT Number', 'tax_id'],
	['Tax ID', 'tax_id'],
	['EIN', 'tax_id'],
	['Website', 'website'],
	['Company Website', 'website'],
	['URL', 'website'],
	['Domain', 'website'],
	['Company Domain Name', 'website'],
	['Main Phone', 'phone'],
	['Company Email', 'email'],
	['Industry', 'industry'],
	['SIC Code', 'industry'],
	['Registered Office Address', 'address'],
	['BillingCity', 'city'],
	['Country of Incorporation', 'country']
]

test('organisations: common column names map to their field', () => {
	for (const [header, role] of COMPANIES) {
		assert.equal(roleOf(header, 'company'), role, header)
	}
})

const PRODUCTS: Array<[string, IdentityRole | null]> = [
	['Product Name', 'product_name'],
	['Title', 'product_name'],
	['Item Name', 'product_name'],
	['Name', 'product_name'],
	['Brand', 'brand'],
	['Make', 'brand'],
	['Manufacturer', 'manufacturer'],
	['Mfr', 'manufacturer'],
	['GTIN', 'gtin'],
	['EAN', 'gtin'],
	['EAN13', 'gtin'],
	['UPC', 'gtin'],
	['Barcode', 'gtin'],
	['ISBN', 'gtin'],
	['MPN', 'mpn'],
	['Manufacturer Part Number', 'mpn'],
	['Part No', 'mpn'],
	['MfrPartNum', 'mpn'],
	['SKU', 'sku'],
	['Variant SKU', 'sku'],
	['Item Code', 'sku'],
	['Article Number', 'sku'],
	['Product Code', 'sku'],
	['Model', 'model_number'],
	['Model Number', 'model_number'],
	['Category', 'category'],
	['Product Type', 'category'],
	['Colour', 'color'],
	['Color', 'color'],
	['Size', 'size'],
	['Pack Size', 'size'],
	['Description', 'description'],
	['Body (HTML)', 'description']
]

test('products: common column names map to their field', () => {
	for (const [header, role] of PRODUCTS) {
		assert.equal(roleOf(header, 'product'), role, header)
	}
})

test('values confirm a name, name a column alone, or rule a vague name out', () => {
	const rows = [
		['a@x.test', 'https://acme.test', '4006381333931', 'yes'],
		['b@y.test', 'www.beta.test', '5012345678900', 'no'],
		['c@z.test', 'gamma.test', '0012345678905', 'yes']
	]
	const company = suggestFields({
		headers: ['col1', 'col2', 'col3', 'Email opt out'],
		rows,
		type: 'company'
	})
	assert.equal(company.get('col1')?.role, 'email')
	assert.equal(company.get('col2')?.role, 'website')
	assert.equal(company.get('Email opt out'), undefined)
	const product = suggestFields({ headers: ['col1', 'col2', 'col3'], rows, type: 'product' })
	assert.equal(product.get('col3')?.role, 'gtin')
})

test('each field goes to one column: the clearest', () => {
	const fields = suggestFields({
		headers: ['Work Email', 'Email', 'Name', 'Account Name'],
		rows: [],
		type: 'company'
	})
	assert.equal(fields.get('Email')?.role, 'email')
	assert.equal(fields.get('Work Email'), undefined)
	assert.equal(fields.get('Name')?.role, 'company_name')
	assert.equal(fields.get('Account Name'), undefined)
})

test('the reference column is an id-looking name, else the first', () => {
	assert.equal(suggestReferenceColumn(['Name', 'Customer ID', 'Email']), 'Customer ID')
	assert.equal(suggestReferenceColumn(['Name', 'record_id']), 'record_id')
	assert.equal(suggestReferenceColumn(['Name', 'AccountNumber']), 'AccountNumber')
	assert.equal(suggestReferenceColumn(['title', 'ProductRef']), 'ProductRef')
	assert.equal(suggestReferenceColumn(['A', 'B']), 'A')
})

test('a file is read as the type its columns and values point to', () => {
	const people = detectEntityType({
		headers: ['id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'postcode'],
		rows: [['1', 'Jane', 'Smith', 'j@x.test', '0123456789', '1990-04-12', 'AB1 2CD']],
		skip: 'id'
	})
	assert.equal(people.type, 'person')
	assert.equal(people.confident, true)

	const companies = detectEntityType({
		headers: ['Account ID', 'Account Name', 'Website', 'Company Number', 'Phone', 'BillingCity'],
		rows: [['A1', 'Acme Ltd', 'acme.test', '01234567', '0123456789', 'Leeds']],
		skip: 'Account ID'
	})
	assert.equal(companies.type, 'company')
	assert.equal(companies.confident, true)

	const products = detectEntityType({
		headers: ['sku', 'title', 'brand', 'gtin', 'color', 'size'],
		rows: [['S1', 'Trail shoe', 'Northpeak', '4006381333931', 'Red', '42']],
		skip: 'sku'
	})
	assert.equal(products.type, 'product')
	assert.equal(products.confident, true)

	// Names alone could be anything: people, but not confidently.
	const vague = detectEntityType({ headers: ['id', 'name', 'email'], rows: [], skip: 'id' })
	assert.equal(vague.type, 'person')
	assert.equal(vague.confident, false)

	// "Acme Ltd" in a name column says organisation.
	const legalForms = detectEntityType({
		headers: ['id', 'name', 'email'],
		rows: [
			['1', 'Acme Ltd', 'a@acme.test'],
			['2', 'Beta GmbH', 'b@beta.test']
		],
		skip: 'id'
	})
	assert.equal(legalForms.type, 'company')

	// People with an employer column are still people: "Full Name" says so,
	// and "Acme Ltd" is where they work.
	const employees = detectEntityType({
		headers: ['Customer ID', 'Full Name', 'Email', 'Company Name', 'City'],
		rows: [
			['1', 'Ada Lovelace', 'ada@x.test', 'Acme Ltd', 'London'],
			['2', 'Bob Ray', 'bob@y.test', 'Brightwater Ltd', 'Leeds'],
			['3', 'Cy Doe', 'cy@z.test', 'Northwind Inc', 'York']
		],
		skip: 'Customer ID'
	})
	assert.equal(employees.type, 'person')

	// A company file's contact person doesn't make it a people file.
	const accounts = detectEntityType({
		headers: ['Account ID', 'Account Name', 'Contact Name', 'Website', 'Phone'],
		rows: [
			['A1', 'Acme Ltd', 'Ada Lovelace', 'acme.test', '0123456789'],
			['A2', 'Beta GmbH', 'Bob Ray', 'beta.test', '0123456780']
		],
		skip: 'Account ID'
	})
	assert.equal(accounts.type, 'company')
})
