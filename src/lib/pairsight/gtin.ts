// GS1 barcodes (EAN-8, UPC-A, EAN-13, GTIN-14). Client-safe, so the mapping
// screen and the server agree on what a valid barcode is.

const GTIN_LENGTHS = new Set([8, 12, 13, 14])
const CHECK_DIGIT_MODULUS = 10
const ODD_POSITION_WEIGHT = 3

// The GS1 check digit: weights 3 and 1 alternate from the right, skipping the
// check digit itself.
export function isValidGtin(digits: string): boolean {
	if (!/^\d+$/.test(digits) || !GTIN_LENGTHS.has(digits.length)) return false
	const body = digits.slice(0, -1)
	let sum = 0
	for (let index = 0; index < body.length; index += 1) {
		const digit = Number(body[body.length - 1 - index])
		sum += index % 2 === 0 ? digit * ODD_POSITION_WEIGHT : digit
	}
	const check = (CHECK_DIGIT_MODULUS - (sum % CHECK_DIGIT_MODULUS)) % CHECK_DIGIT_MODULUS
	return check === Number(digits.at(-1))
}
