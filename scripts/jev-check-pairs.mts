// Fictional pairs for pnpm jev:check (scripts/jev-check.mts): each case from
// the demo scenario, with the judgment a person would expect. Reserved
// example.com domains and 555-01xx numbers only.

type Fields = Record<string, string>
export const PAIRS: Array<{ label: string; expect: string; a: Fields; b: Fields }> = [
	{
		label: 'same person, formatting differs',
		expect: 'high',
		a: {
			first_name: 'Jane',
			last_name: 'Smith',
			email: 'jane.smith@example.com',
			phone: '(415) 555-0101',
			date_of_birth: '1990-04-12'
		},
		b: {
			first_name: 'JANE',
			last_name: 'SMITH',
			email: 'Jane.Smith@Example.com',
			phone: '415-555-0101',
			date_of_birth: '1990-04-12'
		}
	},
	{
		label: 'misspelled surname, same email and birth date',
		expect: 'high',
		a: {
			first_name: 'Jane',
			last_name: 'Smith',
			email: 'jane.smith@example.com',
			date_of_birth: '1990-04-12'
		},
		b: {
			first_name: 'Jane',
			last_name: 'Smyth',
			email: 'jane.smith@example.com',
			date_of_birth: '1990-04-12'
		}
	},
	{
		label: 'relatives sharing phone and address',
		expect: 'low',
		a: {
			first_name: 'Tom',
			last_name: 'Brennan',
			phone: '(312) 555-0144',
			date_of_birth: '1978-09-03',
			address: '88 Lake Ave'
		},
		b: {
			first_name: 'Tim',
			last_name: 'Brennan',
			phone: '(312) 555-0144',
			date_of_birth: '2005-06-21',
			address: '88 Lake Ave'
		}
	},
	{
		label: 'common name, different birth date and email',
		expect: 'low',
		a: {
			first_name: 'Maria',
			last_name: 'Garcia',
			email: 'maria.garcia@example.com',
			date_of_birth: '1985-02-17'
		},
		b: {
			first_name: 'Maria',
			last_name: 'Garcia',
			email: 'mgarcia85@example.org',
			date_of_birth: '1962-11-30'
		}
	},
	{
		label: 'same person who moved',
		expect: 'high?',
		a: {
			first_name: 'David',
			last_name: 'Okafor',
			email: 'd.okafor@example.com',
			date_of_birth: '1981-07-08',
			postcode: '10001'
		},
		b: {
			first_name: 'David',
			last_name: 'Okafor',
			email: 'david.okafor@example.net',
			date_of_birth: '1981-07-08',
			postcode: '98101'
		}
	},
	{
		label: 'nickname, one birth date missing',
		expect: 'borderline',
		a: { first_name: 'Bob', last_name: 'Chen', phone: '(617) 555-0155', address: '22 Beacon St' },
		b: {
			first_name: 'Robert',
			last_name: 'Chen',
			phone: '(617) 555-0155',
			date_of_birth: '1988-05-05',
			address: '22 Beacon St'
		}
	},
	{
		label: 'unrelated people',
		expect: 'low',
		a: {
			first_name: 'Alan',
			last_name: 'Park',
			email: 'alan.park@example.com',
			date_of_birth: '1970-01-01'
		},
		b: {
			first_name: 'Nina',
			last_name: 'Patel',
			email: 'nina.patel@example.com',
			date_of_birth: '1992-03-14'
		}
	}
]

// Organisations and products (pnpm jev:check --types), each asked its own
// type's question with its default definition. Reserved .test domains,
// made-up registration numbers and brands only.
export const TYPE_PAIRS: Array<{
	type: 'company' | 'product'
	label: string
	expect: string
	a: Fields
	b: Fields
}> = [
	{
		type: 'company',
		label: 'same company, legal form and formatting differ',
		expect: 'high',
		a: {
			company_name: 'Northwind Traders Ltd',
			website: 'https://www.northwind.test',
			phone: '+44 20 7946 0101',
			city: 'London'
		},
		b: {
			company_name: 'NORTHWIND TRADERS LIMITED',
			website: 'northwind.test',
			phone: '020 7946 0101',
			city: 'London'
		}
	},
	{
		type: 'company',
		label: 'same company under its trading name',
		expect: 'high',
		a: {
			company_name: 'Halden Brewing Company Ltd',
			registration_number: '09990001',
			city: 'Leeds'
		},
		b: { company_name: 'Halden Brewery', registration_number: '09990001', city: 'Leeds' }
	},
	{
		type: 'company',
		label: 'company that moved offices',
		expect: 'high?',
		a: {
			company_name: 'Clearline Analytics Inc',
			website: 'clearline.test',
			address: '12 Market St',
			city: 'Boston'
		},
		b: {
			company_name: 'Clearline Analytics, Inc.',
			website: 'clearline.test',
			address: '400 Harbor Way',
			city: 'Cambridge'
		}
	},
	{
		type: 'company',
		label: 'parent and subsidiary',
		expect: 'low',
		a: { company_name: 'Orbis Group plc', registration_number: '09990002', website: 'orbis.test' },
		b: {
			company_name: 'Orbis Logistics Ltd',
			registration_number: '09990003',
			website: 'logistics.orbis.test'
		}
	},
	{
		type: 'company',
		label: 'unrelated companies sharing an address',
		expect: 'low',
		a: {
			company_name: 'Bluepeak Consulting Ltd',
			address: '1 Business Park',
			city: 'Bristol',
			phone: '0117 496 0001'
		},
		b: {
			company_name: 'Greenfield Catering Ltd',
			address: '1 Business Park',
			city: 'Bristol',
			phone: '0117 496 0002'
		}
	},
	{
		type: 'company',
		label: 'similar names, different countries and registrations',
		expect: 'low',
		a: { company_name: 'Apex Solutions GmbH', registration_number: 'HRB 999001', country: 'DE' },
		b: { company_name: 'Apex Solutions LLC', registration_number: '99-9990001', country: 'US' }
	},
	{
		type: 'company',
		label: 'abbreviated name, same domain',
		expect: 'high',
		a: { company_name: 'Kestrel Data Systems Corporation', website: 'kestreldata.test' },
		b: { company_name: 'KDS Corp', website: 'www.kestreldata.test' }
	},
	{
		type: 'product',
		label: 'same product, title formatted differently',
		expect: 'high',
		a: {
			product_name: 'Trailrunner 2 Running Shoe - Red, Size 42',
			brand: 'Northpeak',
			gtin: '4006381333931',
			mpn: 'TR2-RED-42'
		},
		b: {
			product_name: 'NORTHPEAK TRAILRUNNER 2 RED 42',
			brand: 'Northpeak',
			gtin: '04006381333931',
			mpn: 'TR2RED42'
		}
	},
	{
		type: 'product',
		label: 'same item, UPC vs EAN and a different title',
		expect: 'high',
		a: {
			product_name: 'Stainless Steel Water Bottle 750ml',
			brand: 'Halcyon',
			gtin: '012345678905'
		},
		b: { product_name: 'Halcyon Insulated Bottle, 0.75 L', brand: 'Halcyon', gtin: '0012345678905' }
	},
	{
		type: 'product',
		label: 'same shoe, different size',
		expect: 'low',
		a: {
			product_name: 'Trailrunner 2 Running Shoe - Red',
			brand: 'Northpeak',
			size: '42',
			mpn: 'TR2-RED-42'
		},
		b: {
			product_name: 'Trailrunner 2 Running Shoe - Red',
			brand: 'Northpeak',
			size: '44',
			mpn: 'TR2-RED-44'
		}
	},
	{
		type: 'product',
		label: 'single item vs a 6-pack',
		expect: 'low',
		a: { product_name: 'Sparkling Water 330ml Can', brand: 'Fjell', size: '330 ml' },
		b: { product_name: 'Sparkling Water 330ml Can, Pack of 6', brand: 'Fjell', size: '6 x 330 ml' }
	},
	{
		type: 'product',
		label: 'same name, different brands',
		expect: 'low',
		a: { product_name: 'Classic Wireless Mouse', brand: 'Vantor', model_number: 'VM-100' },
		b: { product_name: 'Classic Wireless Mouse', brand: 'Kestrel', model_number: 'KM-2' }
	},
	{
		type: 'product',
		label: 'same model, colour differs',
		expect: 'low',
		a: { product_name: 'Aero Backpack 30L', brand: 'Northpeak', color: 'Black', sku: 'AERO30-BLK' },
		b: { product_name: 'Aero Backpack 30L', brand: 'Northpeak', color: 'Olive', sku: 'AERO30-OLV' }
	},
	{
		type: 'product',
		label: 'same product, part number on one side, model on the other',
		expect: 'high?',
		a: { product_name: 'Kestrel Pro USB-C Hub 7-in-1', brand: 'Kestrel', mpn: 'KH-7C' },
		b: { product_name: 'Kestrel Pro 7 port USB C hub', brand: 'Kestrel', model_number: 'KH-7C' }
	}
]
