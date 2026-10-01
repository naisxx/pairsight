'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/ui/icons'
import { Select as SelectPrimitive } from 'radix-ui'
import { fieldClassName } from './input'

const CARET_SIZE = 14
const CHECK_SIZE = 14

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
	className,
	size = 'default',
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
	size?: 'sm' | 'default'
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				fieldClassName,
				'data-[state=open]:border-text-muted data-[placeholder]:text-text-muted data-[size=sm]:type-ui flex cursor-pointer items-center justify-between gap-2 pr-2.5 text-left whitespace-nowrap data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0',
				className
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<ChevronDownIcon size={CARET_SIZE} className="text-text-muted" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	)
}

function SelectContent({
	className,
	children,
	position = 'popper',
	align = 'start',
	sideOffset = 6,
	collisionPadding = 8,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				data-slot="select-content"
				className={cn(
					'border-border bg-surface-elevated text-text shadow-elevated data-[state=open]:animate-float-in relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border',
					className
				)}
				position={position}
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				{...props}
			>
				<SelectScrollUpButton />
				<SelectPrimitive.Viewport
					className={cn(
						'p-1',
						position === 'popper' && 'w-full min-w-(--radix-select-trigger-width) scroll-my-1'
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectScrollDownButton />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	)
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
	return (
		<SelectPrimitive.Label
			data-slot="select-label"
			className={cn('text-text-muted type-caption px-2.5 py-1.5', className)}
			{...props}
		/>
	)
}

function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"type-ui text-text data-[highlighted]:bg-surface-hover [&_svg:not([class*='text-'])]:text-text-muted relative flex w-full cursor-pointer items-center gap-2 rounded-[6px] py-1.5 pr-8 pl-2.5 outline-hidden transition-colors duration-100 select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
				className
			)}
			{...props}
		>
			<span
				data-slot="select-item-indicator"
				className="absolute right-2.5 flex size-3.5 items-center justify-center"
			>
				<SelectPrimitive.ItemIndicator>
					<CheckIcon size={CHECK_SIZE} />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	)
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
			{...props}
		/>
	)
}

function SelectScrollUpButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
	return (
		<SelectPrimitive.ScrollUpButton
			data-slot="select-scroll-up-button"
			className={cn('flex cursor-default items-center justify-center py-1', className)}
			{...props}
		>
			<ChevronUpIcon size={CARET_SIZE} />
		</SelectPrimitive.ScrollUpButton>
	)
}

function SelectScrollDownButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
	return (
		<SelectPrimitive.ScrollDownButton
			data-slot="select-scroll-down-button"
			className={cn('flex cursor-default items-center justify-center py-1', className)}
			{...props}
		>
			<ChevronDownIcon size={CARET_SIZE} />
		</SelectPrimitive.ScrollDownButton>
	)
}

// Radix reserves "" for "nothing selected", but an "Any …" option uses it as
// a real value, so it travels through the primitive under this stand-in.
const EMPTY_VALUE = '__empty__'
const toPrimitive = (value: string) => (value === '' ? EMPTY_VALUE : value)
const fromPrimitive = (value: string) => (value === EMPTY_VALUE ? '' : value)

type SelectOption = { value: string; label: string }

// The common case in one piece: a list of options, a value and a change.
function OptionSelect({
	value,
	onValueChange,
	options,
	size = 'default',
	id,
	className,
	'aria-label': ariaLabel
}: {
	value: string
	onValueChange: (value: string) => void
	options: SelectOption[]
	size?: 'sm' | 'default'
	id?: string
	className?: string
	'aria-label'?: string
}) {
	return (
		<Select value={toPrimitive(value)} onValueChange={(next) => onValueChange(fromPrimitive(next))}>
			<SelectTrigger id={id} size={size} aria-label={ariaLabel} className={className}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={toPrimitive(option.value)}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

export type { SelectOption }
export {
	OptionSelect,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue
}
