'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import {
	ArrowRightIcon,
	HideIcon,
	ShowIcon,
	SpinnerIcon,
	WarningCircleIcon
} from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { credentialsSchema, MIN_PASSWORD_LENGTH } from '@/lib/auth/credentials'
import { signIn, signUp } from '@/server/actions/auth'

const ICON_SIZE = 16
const LABEL_CLASS_NAME = 'mb-1.5 block text-sm font-semibold'
// A link inside the sign-up line (Terms, Privacy policy).
const LEGAL_LINK_CLASS_NAME =
	'text-text decoration-border-strong hover:decoration-text underline underline-offset-[3px]'

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
		<>
			<form
				noValidate
				className="mt-8 flex flex-col"
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

				<label htmlFor={`${id}-email`} className={LABEL_CLASS_NAME}>
					{t('email')}
				</label>
				<Input
					id={`${id}-email`}
					type="email"
					autoComplete="email"
					autoFocus
					placeholder={t('emailPlaceholder')}
					className="text-base"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					aria-invalid={showEmailError}
					aria-describedby={showEmailError ? `${id}-email-error` : undefined}
				/>
				{showEmailError && (
					<p id={`${id}-email-error`} className="text-danger mt-1.5 text-sm">
						{emailError}
					</p>
				)}

				<label htmlFor={`${id}-password`} className={`${LABEL_CLASS_NAME} mt-5`}>
					{t('password')}
				</label>
				<div className="relative">
					<Input
						id={`${id}-password`}
						type={isShown ? 'text' : 'password'}
						autoComplete={isSignIn ? 'current-password' : 'new-password'}
						className="pr-12 text-base"
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
						className="text-text-muted hover:text-text absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm"
					>
						{isShown ? <HideIcon size={ICON_SIZE} /> : <ShowIcon size={ICON_SIZE} />}
					</button>
				</div>
				{showPasswordError ? (
					<p id={`${id}-password-error`} className="text-danger mt-1.5 text-sm">
						{passwordError}
					</p>
				) : (
					!isSignIn && (
						<p id={`${id}-password-hint`} className="text-text-muted mt-1.5 text-sm">
							{t('passwordHint')}
						</p>
					)
				)}

				<Button
					type="submit"
					className="mt-5 self-start"
					disabled={isPending}
					cap={isPending ? <SpinnerIcon size={ICON_SIZE} /> : <ArrowRightIcon />}
				>
					{isPending ? t(isSignIn ? 'signingIn' : 'signingUp') : t(isSignIn ? 'signIn' : 'signUp')}
				</Button>
			</form>

			<p className="text-text-body border-border mt-8 border-t pt-6">
				{t(isSignIn ? 'noAccount' : 'haveAccount')}{' '}
				<Link
					href={{
						pathname: isSignIn ? '/sign-up' : '/sign-in',
						query: next != null ? { next } : {}
					}}
					className="text-text decoration-border-strong hover:decoration-text inline-flex min-h-11 items-center underline underline-offset-[3px]"
				>
					{t(isSignIn ? 'toSignUp' : 'toSignIn')}
				</Link>
			</p>
			{!isSignIn && (
				<p className="text-text-muted mt-2 text-sm">
					{t.rich('agreeTerms', {
						terms: (chunks) => (
							<Link href="/terms" className={LEGAL_LINK_CLASS_NAME}>
								{chunks}
							</Link>
						),
						privacy: (chunks) => (
							<Link href="/privacy" className={LEGAL_LINK_CLASS_NAME}>
								{chunks}
							</Link>
						)
					})}
				</p>
			)}
		</>
	)
}
