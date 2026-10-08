// The only file in this project allowed to import an icon library.
// `no-restricted-imports` in eslint.config.mjs enforces that — everything
// else imports from '@/components/ui/icons'. See docs/rules/icons.md for
// the why; this file is the how.
//
// Swapping provider (phosphor -> lucide, heroicons, tabler, ...) is three
// edits, all inside this file:
//   1. the import below,
//   2. `Glyph`'s body, so the provider's own prop names get the same
//      IconProps shape mapped onto them,
//   3. the export list, mapping each name to the new provider's equivalent.
// Nothing outside this file changes — that's the entire point of it.
//
// Imported from phosphor's `/ssr` entry, not its root, deliberately: the
// root entry's icons read their defaults from a React context, which makes
// them Client Components, and the package ships no 'use client' directive
// to say so — a Server Component rendering one fails at request time. The
// `/ssr` build takes its props directly and renders in both. Keep this
// import path if you stay on phosphor.
import {
	ArrowClockwise,
	ArrowLeft,
	ArrowCounterClockwise,
	ArrowRight,
	ArrowsClockwise,
	ArrowsLeftRight,
	ArrowSquareOut,
	BuildingOffice,
	Buildings,
	Calendar,
	CaretDown,
	CaretLeft,
	CaretRight,
	CaretUp,
	CaretUpDown,
	ChartBar,
	Check,
	CheckCircle,
	Circle,
	CircleDashed,
	CircleNotch,
	Compass,
	Copy,
	Desktop,
	DotsThree,
	DotsThreeVertical,
	DownloadSimple,
	Equals,
	Eye,
	EyeSlash,
	FileCsv,
	FilePdf,
	FileXls,
	FileText,
	FlowArrow,
	FolderOpen,
	FunnelSimple,
	FunnelX,
	Gear,
	HourglassMedium,
	IdentificationCard,
	Info,
	Intersect,
	Lightbulb,
	List,
	ListChecks,
	Lock,
	MagnifyingGlass,
	Minus,
	MinusCircle,
	Moon,
	NotEquals,
	Package,
	PaperPlaneTilt,
	Pause,
	PencilSimple,
	Play,
	Plugs,
	Plus,
	Question,
	Robot,
	ShieldCheck,
	SidebarSimple,
	SignIn,
	SignOut,
	Sliders,
	Sparkle,
	SquaresFour,
	Storefront,
	Sun,
	Table,
	Trash,
	UploadSimple,
	User,
	UserCheck,
	Users,
	Warning,
	WarningCircle,
	WarningOctagon,
	X,
	XCircle
} from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

// Deliberately narrower than the provider's own props: a call site can set
// size and classes, and nothing else. Provider-specific props (phosphor's
// `weight` and `mirrored`, lucide's `strokeWidth`) stay out so a swap can't
// break call sites — set those once in `Glyph` below if this project wants
// a different house style.
export type IconProps = {
	// Pixels. 16 pairs with `text-sm`; bump per call site, don't change the
	// default without checking the components that rely on it.
	size?: number
	className?: string
	// How the glyph is drawn, in provider-neutral terms: `line` everywhere by
	// default, `bold` for small marks that must read at 10–11px (checks,
	// locks, ≠), and `solid` for active and selected states.
	variant?: IconVariant
}

export type IconVariant = 'line' | 'bold' | 'solid'

const PROVIDER_WEIGHT = {
	line: 'regular',
	bold: 'bold',
	solid: 'fill'
} as const

const DEFAULT_SIZE = 16

function Glyph({
	source: Source,
	size = DEFAULT_SIZE,
	className,
	variant = 'line'
}: IconProps & { source: Icon }) {
	return (
		<Source
			size={size}
			className={className}
			// Every icon here is decorative — it sits next to a text label, or
			// inside a control that carries its own aria-label. Hiding it stops
			// a screen reader announcing the same thing twice. An icon-only
			// button labels the *button*, never the glyph (see DESIGN.md's
			// accessibility baseline), so there is no per-icon label prop.
			aria-hidden
			// Icons inherit the text color of whatever they sit in — that's why
			// no color token appears anywhere in this file.
			color="currentColor"
			// The house stroke weight lives in PROVIDER_WEIGHT; change `line` there
			// to restyle every icon at once.
			weight={PROVIDER_WEIGHT[variant]}
			data-icon-variant={variant}
		/>
	)
}

// One line per icon, named for its role where the project has one
// (SpinnerIcon, not CircleNotchIcon) — a rename here should never cascade
// through call sites, same rule as the design tokens in DESIGN.md. It also
// means the next provider's spelling (phosphor's CaretDown vs. lucide's
// ChevronDown) stays behind this file.
//
// Add an icon when a component actually needs it; don't mirror the
// provider's whole catalog here. Keep the list alphabetical.
export const AlertIcon = (props: IconProps) => <Glyph source={Warning} {...props} />
export const ArrowCounterClockwiseIcon = (props: IconProps) => (
	<Glyph source={ArrowCounterClockwise} {...props} />
)
export const ArrowRightIcon = (props: IconProps) => <Glyph source={ArrowRight} {...props} />
export const CalendarIcon = (props: IconProps) => <Glyph source={Calendar} {...props} />
export const CheckIcon = (props: IconProps) => <Glyph source={Check} {...props} />
export const ChevronDownIcon = (props: IconProps) => <Glyph source={CaretDown} {...props} />
export const ChevronLeftIcon = (props: IconProps) => <Glyph source={CaretLeft} {...props} />
export const ChevronRightIcon = (props: IconProps) => <Glyph source={CaretRight} {...props} />
export const ChevronUpIcon = (props: IconProps) => <Glyph source={CaretUp} {...props} />
export const ChevronsUpDownIcon = (props: IconProps) => <Glyph source={CaretUpDown} {...props} />
export const CloseIcon = (props: IconProps) => <Glyph source={X} {...props} />
export const DotIcon = (props: IconProps) => <Glyph source={Circle} {...props} />
export const CopyIcon = (props: IconProps) => <Glyph source={Copy} {...props} />
export const DownloadIcon = (props: IconProps) => <Glyph source={DownloadSimple} {...props} />
export const EditIcon = (props: IconProps) => <Glyph source={PencilSimple} {...props} />
export const ExternalLinkIcon = (props: IconProps) => <Glyph source={ArrowSquareOut} {...props} />
export const FilterIcon = (props: IconProps) => <Glyph source={FunnelSimple} {...props} />
export const InfoIcon = (props: IconProps) => <Glyph source={Info} {...props} />
export const MenuIcon = (props: IconProps) => <Glyph source={List} {...props} />
export const MinusIcon = (props: IconProps) => <Glyph source={Minus} {...props} />
export const MoreIcon = (props: IconProps) => <Glyph source={DotsThreeVertical} {...props} />
export const MoreHorizontalIcon = (props: IconProps) => <Glyph source={DotsThree} {...props} />
export const PlusIcon = (props: IconProps) => <Glyph source={Plus} {...props} />
export const SearchIcon = (props: IconProps) => <Glyph source={MagnifyingGlass} {...props} />
export const SettingsIcon = (props: IconProps) => <Glyph source={Gear} {...props} />
export const SignInIcon = (props: IconProps) => <Glyph source={SignIn} {...props} />
export const SignOutIcon = (props: IconProps) => <Glyph source={SignOut} {...props} />
export const SidebarIcon = (props: IconProps) => <Glyph source={SidebarSimple} {...props} />
export const GridIcon = (props: IconProps) => <Glyph source={SquaresFour} {...props} />
export const SuccessIcon = (props: IconProps) => <Glyph source={CheckCircle} {...props} />
export const TrashIcon = (props: IconProps) => <Glyph source={Trash} {...props} />
export const ArrowLeftIcon = (props: IconProps) => <Glyph source={ArrowLeft} {...props} />
export const EqualIcon = (props: IconProps) => <Glyph source={Equals} {...props} />
export const FileIcon = (props: IconProps) => <Glyph source={FileText} {...props} />
export const LockIcon = (props: IconProps) => <Glyph source={Lock} {...props} />
export const MissingIcon = (props: IconProps) => <Glyph source={CircleDashed} {...props} />
export const MonitorIcon = (props: IconProps) => <Glyph source={Desktop} {...props} />
export const MoonIcon = (props: IconProps) => <Glyph source={Moon} {...props} />
export const NotEqualIcon = (props: IconProps) => <Glyph source={NotEquals} {...props} />
export const PlayIcon = (props: IconProps) => <Glyph source={Play} {...props} />
export const RetryIcon = (props: IconProps) => <Glyph source={ArrowClockwise} {...props} />
export const SunIcon = (props: IconProps) => <Glyph source={Sun} {...props} />
export const UploadIcon = (props: IconProps) => <Glyph source={UploadSimple} {...props} />
export const UserIcon = (props: IconProps) => <Glyph source={User} {...props} />

// The spinner is the one icon that carries its own behaviour — every call
// site was animating it by hand, so it does it here instead. `motion-reduce`
// honours prefers-reduced-motion (DESIGN.md).
export const SpinnerIcon = ({ className, ...props }: IconProps) => (
	<Glyph
		source={CircleNotch}
		className={cn('animate-spin motion-reduce:animate-none', className)}
		{...props}
	/>
)
export const ConnectionErrorIcon = (props: IconProps) => <Glyph source={Plugs} {...props} />
export const CsvFileIcon = (props: IconProps) => <Glyph source={FileCsv} {...props} />
export const XlsxFileIcon = (props: IconProps) => <Glyph source={FileXls} {...props} />
export const PdfFileIcon = (props: IconProps) => <Glyph source={FilePdf} {...props} />
export const ErrorIcon = (props: IconProps) => <Glyph source={WarningOctagon} {...props} />
export const EvaluationIcon = (props: IconProps) => <Glyph source={Intersect} {...props} />
export const FieldsIcon = (props: IconProps) => <Glyph source={ListChecks} {...props} />
export const IdentityIcon = (props: IconProps) => <Glyph source={IdentificationCard} {...props} />
export const NoMatchesIcon = (props: IconProps) => <Glyph source={FunnelX} {...props} />
export const NotFoundIcon = (props: IconProps) => <Glyph source={Compass} {...props} />
export const SendIcon = (props: IconProps) => <Glyph source={PaperPlaneTilt} {...props} />
export const VendorIcon = (props: IconProps) => <Glyph source={Buildings} {...props} />
export const OrganisationIcon = (props: IconProps) => <Glyph source={BuildingOffice} {...props} />
export const ProductIcon = (props: IconProps) => <Glyph source={Package} {...props} />
export const WaitingIcon = (props: IconProps) => <Glyph source={HourglassMedium} {...props} />
export const AiIcon = (props: IconProps) => <Glyph source={Robot} {...props} />
export const ChartIcon = (props: IconProps) => <Glyph source={ChartBar} {...props} />
export const DifferentPeopleIcon = (props: IconProps) => <Glyph source={Users} {...props} />
export const FailedIcon = (props: IconProps) => <Glyph source={XCircle} {...props} />
export const FlowIcon = (props: IconProps) => <Glyph source={FlowArrow} {...props} />
export const FolderIcon = (props: IconProps) => <Glyph source={FolderOpen} {...props} />
export const HideIcon = (props: IconProps) => <Glyph source={EyeSlash} {...props} />
export const InsightIcon = (props: IconProps) => <Glyph source={Lightbulb} {...props} />
export const NotMatchedIcon = (props: IconProps) => <Glyph source={MinusCircle} {...props} />
export const PauseIcon = (props: IconProps) => <Glyph source={Pause} {...props} />
export const QuestionIcon = (props: IconProps) => <Glyph source={Question} {...props} />
export const RefreshIcon = (props: IconProps) => <Glyph source={ArrowsClockwise} {...props} />
export const SamePersonIcon = (props: IconProps) => <Glyph source={UserCheck} {...props} />
export const ShieldIcon = (props: IconProps) => <Glyph source={ShieldCheck} {...props} />
export const ShowIcon = (props: IconProps) => <Glyph source={Eye} {...props} />
export const SlidersIcon = (props: IconProps) => <Glyph source={Sliders} {...props} />
export const SparkleIcon = (props: IconProps) => <Glyph source={Sparkle} {...props} />
export const StoreIcon = (props: IconProps) => <Glyph source={Storefront} {...props} />
export const SwapIcon = (props: IconProps) => <Glyph source={ArrowsLeftRight} {...props} />
export const TableIcon = (props: IconProps) => <Glyph source={Table} {...props} />
export const WarningCircleIcon = (props: IconProps) => <Glyph source={WarningCircle} {...props} />
