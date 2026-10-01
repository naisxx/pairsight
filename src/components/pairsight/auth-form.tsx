'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { HideIcon, ShowIcon, SpinnerIcon, WarningCircleIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { credentialsSchema, MIN_PASSWORD_LENGTH } from '@/lib/auth/credentials'
import { signIn, signUp } from '@/server/actions/auth'

const ICON_SIZE = 16

// Email and password, checked field by field once the form is first
// submitted (then as you type) — never on blur, so leaving a field isn't an
// error. The server checks again; its answer shows above the fields.
export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next?: string }) {
	const t = useTranslations('Auth')
	const id = useId()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isShown, setIsShown] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const isSignIn = mode === 'sign-in'

	const emailError =
		email.trim() === ''
			? t('emailRequired')
			: credentialsSchema.shape.email.safeParse(email).success
				? null
				: t('emailInvalid')
	// The same minimum the actions enforce, so a request bound to fail isn't sent.
	const passwordError =
		password === ''
			? t('passwordRequired')
			: password.length < MIN_PASSWORD_LENGTH
				? t('passwordShort', { min: MIN_PASSWORD_LENGTH })
				: null
	const showEmailError = isSubmitted && emailError != null
	const showPasswordError = isSubmitted && passwordError != null

	return (
		<form
			noValidate
			className="border-border bg-surface mt-7 rounded-md border p-5"
			onSubmit={(event) => {
				event.preventDefault()
				setIsSubmitted(true)
				setFormError(null)
				setNotice(null)
				if (emailError != null || passwordError != null) return
				startTransition(async () => {
					const input = { email, password, next }
					const result = await (isSignIn ? signIn(input) : signUp(input))
					if (!result.ok) setFormError(result.error)
					else if (result.data != null && 'needsConfirmation' in result.data) {
						setNotice(t('checkEmail'))
					}
				})
			}}
		>
			{formError != null && (
				<div
					role="alert"
					className="bg-danger-subtle text-danger type-ui mb-4 flex gap-2 rounded-sm p-3"
				>
					<WarningCircleIcon size={ICON_SIZE} className="mt-px shrink-0" />
					{formError}
				</div>
			)}
			{notice != null && (
				<p role="status" className="bg-info-subtle text-info type-ui mb-4 rounded-sm p-3">
					{notice}
				</p>
			)}

			<label htmlFor={`${id}-email`} className="type-ui font-medium">
				{t('email')}
			</label>
			<Input
				id={`${id}-email`}
				type="email"
				autoComplete="email"
				autoFocus
				className="mt-1.5"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				aria-invalid={showEmailError}
				aria-describedby={showEmailError ? `${id}-email-error` : undefined}
			/>
			{showEmailError && (
				<p id={`${id}-email-error`} className="text-danger mt-1.5 text-xs">
					{emailError}
				</p>
			)}

			<label htmlFor={`${id}-password`} className="type-ui mt-4 block font-medium">
				{t('password')}
			</label>
			<div className="relative mt-1.5">
				<Input
					id={`${id}-password`}
					type={isShown ? 'text' : 'password'}
					autoComplete={isSignIn ? 'current-password' : 'new-password'}
					className="pr-10"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					aria-invalid={showPasswordError}
					aria-describedby={
						showPasswordError
							? `${id}-password-error`
							: isSignIn
								? undefined
								: `${id}-password-hint`
					}
				/>
				<button
					type="button"
					onClick={() => setIsShown((shown) => !shown)}
					aria-label={isShown ? t('hidePassword') : t('showPassword')}
					aria-pressed={isShown}
					className="text-text-muted hover:text-text absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm"
				>
					{isShown ? <HideIcon size={ICON_SIZE} /> : <ShowIcon size={ICON_SIZE} />}
				</button>
			</div>
			{showPasswordError ? (
				<p id={`${id}-password-error`} className="text-danger mt-1.5 text-xs">
					{passwordError}
				</p>
			) : (
				!isSignIn && (
					<p id={`${id}-password-hint`} className="text-text-muted mt-1.5 text-xs">
						{t('passwordHint')}
					</p>
				)
			)}

			<Button type="submit" className="mt-5 w-full" disabled={isPending}>
				{isPending && <SpinnerIcon size={ICON_SIZE} />}
				{isPending ? t(isSignIn ? 'signingIn' : 'signingUp') : t(isSignIn ? 'signIn' : 'signUp')}
			</Button>

			<p className="type-ui text-text-muted mt-5 text-center">
				{t(isSignIn ? 'noAccount' : 'haveAccount')}{' '}
				<Link
					href={{
						pathname: isSignIn ? '/sign-up' : '/sign-in',
						query: next != null ? { next } : {}
					}}
					className="text-accent-ink font-medium hover:underline"
				>
					{t(isSignIn ? 'toSignUp' : 'toSignIn')}
				</Link>
			</p>
		</form>
	)
}
