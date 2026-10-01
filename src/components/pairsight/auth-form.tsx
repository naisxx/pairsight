'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { AlertIcon, SpinnerIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { credentialsSchema, MIN_PASSWORD_LENGTH } from '@/lib/auth/credentials'
import { signIn, signUp } from '@/server/actions/auth'

export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next?: string }) {
	const t = useTranslations('Auth')
	const id = useId()
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const isSignIn = mode === 'sign-in'

	function submit(formData: FormData) {
		setError(null)
		setNotice(null)
		const input = {
			email: String(formData.get('email') ?? ''),
			password: String(formData.get('password') ?? ''),
			next
		}
		if (!credentialsSchema.safeParse(input).success)
			return setError(t('invalidInput', { min: MIN_PASSWORD_LENGTH }))
		startTransition(async () => {
			const result = await (isSignIn ? signIn(input) : signUp(input))
			if (!result.ok) setError(result.error)
			else if (result.data != null && 'needsConfirmation' in result.data) setNotice(t('checkEmail'))
		})
	}

	return (
		<form action={submit} className="flex flex-col gap-4" noValidate>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-email`}>{t('email')}</Label>
				<Input
					id={`${id}-email`}
					name="email"
					type="email"
					autoComplete="email"
					required
					autoFocus
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-password`}>{t('password')}</Label>
				<Input
					id={`${id}-password`}
					name="password"
					type="password"
					autoComplete={isSignIn ? 'current-password' : 'new-password'}
					minLength={MIN_PASSWORD_LENGTH}
					required
					aria-describedby={isSignIn ? undefined : `${id}-hint`}
				/>
				{!isSignIn && (
					<p id={`${id}-hint`} className="text-text-muted type-meta">
						{t('passwordHint')}
					</p>
				)}
			</div>
			<div aria-live="polite" className="min-h-0">
				{error != null && (
					<p className="bg-danger-subtle text-danger type-body flex items-start gap-2 rounded px-3 py-2">
						<AlertIcon className="mt-0.5 shrink-0" />
						{error}
					</p>
				)}
				{notice != null && (
					<p className="bg-info-subtle text-info type-body rounded px-3 py-2">{notice}</p>
				)}
			</div>
			<Button type="submit" disabled={isPending} className="w-full">
				{isPending && <SpinnerIcon />}
				{isPending ? t(isSignIn ? 'signingIn' : 'signingUp') : t(isSignIn ? 'signIn' : 'signUp')}
			</Button>
			<p className="text-text-muted type-body text-center">
				{t(isSignIn ? 'noAccount' : 'haveAccount')}{' '}
				<Link
					href={{
						pathname: isSignIn ? '/sign-up' : '/sign-in',
						query: next != null ? { next } : {}
					}}
					className="text-accent-ink font-medium underline-offset-4 hover:underline"
				>
					{t(isSignIn ? 'toSignUp' : 'toSignIn')}
				</Link>
			</p>
		</form>
	)
}
