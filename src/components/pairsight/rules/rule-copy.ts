// Message keys (in the `Rules` namespace) naming each preset blocking rule (of
// every entity type) and its normalization — shared by the Rules screen and
// every rule label.
export const RULE_COPY: Record<string, { title: string; hint: string }> = {
	// Not a rule: Splink's picks (src/server/pairsight/splink/picks.ts), named
	// wherever a pair's reasons for being checked are shown.
	splink: { title: 'ruleSplink', hint: 'ruleSplinkHint' },
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
	name_brand: { title: 'ruleNameBrand', hint: 'ruleNamePostcodeHint' },
	surname_sound_birth_year: { title: 'ruleSurnameSoundYear', hint: 'ruleSurnameSoundYearHint' },
	name_sound_district: { title: 'ruleNameSoundDistrict', hint: 'ruleNameSoundDistrictHint' },
	email_username: { title: 'ruleEmailUsername', hint: 'ruleEmailUsernameHint' },
	name_words_district: { title: 'ruleNameWordsDistrict', hint: 'ruleNameWordsDistrictHint' },
	name_prefix_city: { title: 'ruleNamePrefixCity', hint: 'ruleNamePrefixCityHint' },
	name_words_brand: { title: 'ruleNameWordsBrand', hint: 'ruleNameWordsBrandHint' }
}
