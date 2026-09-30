// Message keys (in the `Rules` namespace) naming each preset blocking rule and
// its normalization — shared by the Rules screen and every rule label.
export const RULE_COPY: Record<string, { title: string; hint: string }> = {
	email: { title: 'ruleEmail', hint: 'ruleEmailHint' },
	phone: { title: 'rulePhone', hint: 'rulePhoneHint' },
	name: { title: 'ruleName', hint: 'ruleNameHint' },
	name_postcode: { title: 'ruleNamePostcode', hint: 'ruleNamePostcodeHint' },
	last_name_postcode: { title: 'ruleLastNamePostcode', hint: 'ruleLastNamePostcodeHint' }
}
