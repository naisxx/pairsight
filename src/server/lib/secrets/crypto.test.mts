import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { decryptSecret, encryptSecret, SecretUnreadableError, secretKeyFrom } from './crypto'

const KEY = randomBytes(32)
// Not a real key: the shape of one, to prove it never shows in the blob.
const PLAIN = 'ts-fictional-0123456789abcdef'

test('a secret round-trips under the same key', () => {
	assert.equal(decryptSecret(encryptSecret(PLAIN, KEY), KEY), PLAIN)
})

test('the stored blob never holds the secret in the clear', () => {
	const blob = encryptSecret(PLAIN, KEY)
	assert.equal(Buffer.from(blob).includes(Buffer.from(PLAIN)), false)
	// A fresh IV each time: the same secret never encrypts the same way twice.
	assert.notDeepEqual(encryptSecret(PLAIN, KEY), blob)
})

test('another key, a changed byte or an unknown version fails closed', () => {
	const blob = encryptSecret(PLAIN, KEY)
	assert.throws(() => decryptSecret(blob, randomBytes(32)), SecretUnreadableError)

	const tampered = Buffer.from(blob)
	tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1
	assert.throws(() => decryptSecret(tampered, KEY), SecretUnreadableError)

	const otherVersion = Buffer.from(blob)
	otherVersion[0] = 2
	assert.throws(() => decryptSecret(otherVersion, KEY), SecretUnreadableError)
	assert.throws(() => decryptSecret(Buffer.alloc(4), KEY), SecretUnreadableError)
})

test('the key is 32 bytes of base64, or none', () => {
	assert.deepEqual(secretKeyFrom(KEY.toString('base64')), KEY)
	assert.equal(secretKeyFrom(undefined), null)
	assert.equal(secretKeyFrom(''), null)
	assert.equal(secretKeyFrom(randomBytes(16).toString('base64')), null)
})
