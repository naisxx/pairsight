// Message keys (in the `Rules` namespace) naming each preset blocking rule (of
// every entity type) and its normalization — shared by the Rules screen and
// every rule label.
export const RULE_COPY: Record<string, { title: string; hint: string }> = {
	email: { title: 'ruleEmail', hint: 'ruleEmailHint' },
	phone: { title: 'rulePhone', hint: 'rulePhoneHint' },
	name: { title: 'ruleName', hint: 'ruleNameHint' },
	name_postcode: { title: 'ruleNamePostcode', hint: 'ruleNamePostcodeHint' },
	last_name_postcode: { title: 'ruleLastNamePostcode', hint: 'ruleLastNamePostcodeHint' },
	name_city: { title: 'ruleNameCity', hint: 'ruleNameCityHint' },
	website: { title: 'ruleWebsite', hint: 'ruleWebsiteHint' },
	registration_number: { title: 'ruleRegistration', hint: 'ruleCodeHint' },
	tax_id: { title: 'ruleTaxId', hint: 'ruleCodeHint' },
	gtin: { title: 'ruleGtin', hint: 'ruleGtinHint' },
	mpn_brand: { title: 'ruleMpnBrand', hint: 'ruleCodeBrandHint' },
	sku_brand: { title: 'ruleSkuBrand', hint: 'ruleCodeBrandHint' },
	name_brand: { title: 'ruleNameBrand', hint: 'ruleNamePostcodeHint' }
}
