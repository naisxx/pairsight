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
