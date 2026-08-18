import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-rule bg-paper-raised rounded-[var(--radius-card)] border shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-ink text-lg font-semibold', className)} {...props} />
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-paper-sunken text-ink-muted',
        accent: 'bg-tomato-soft text-tomato-strong',
        good: 'bg-basil-soft text-basil',
        warn: 'bg-amber-soft text-amber',
        outline: 'border border-rule text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'border-rule bg-paper-raised text-ink h-11 w-full rounded-lg border px-3 text-sm',
        'placeholder:text-ink-faint',
        className,
      )}
      {...props}
    />
  )
}

/**
 * A number field with no spinner and no spinbutton role.
 *
 * `type="number"` brings step arrows the owner does not want, a scroll wheel
 * that silently changes values, and a browser-enforced locale for the decimal
 * separator. Hiding the arrows in CSS would leave the control announcing itself
 * as a spinbutton to a screen reader while offering no way to step it, so the
 * type changes instead: a text field with the right `inputMode` gets the numeric
 * keypad on a phone and keyboard entry everywhere, with validation staying where
 * it always belonged -- in the handler and on the server.
 *
 * `decimal` picks the keypad: `numeric` for whole numbers, `decimal` for
 * anything that can carry a fraction.
 */
export function NumericInput({
  decimal = false,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { decimal?: boolean }) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={className}
    />
  )
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'border-rule bg-paper-raised text-ink h-11 w-full rounded-lg border px-3 text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'border-rule bg-paper-raised text-ink w-full rounded-lg border p-3 text-sm',
        'placeholder:text-ink-faint',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-ink-muted mb-1.5 block text-xs font-medium tracking-wide', className)}
      {...props}
    />
  )
}

/** Section heading with a hairline rule, used across every screen. */
export function SectionHeading({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-ink-muted text-sm font-semibold tracking-wide uppercase">{children}</h2>
      {action}
    </div>
  )
}

/**
 * The empty state used everywhere. It always offers a way forward rather than
 * a dead end -- and never invents content to fill the space.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="border-rule flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center">
      {icon ? <div className="text-ink-faint mb-3">{icon}</div> : null}
      <p className="text-ink font-medium">{title}</p>
      {hint ? <p className="text-ink-muted mt-1 max-w-sm text-sm">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-rule border-0 border-t', className)} />
}

/** Key/value row used in recipe metadata and settings. */
export function DataRow({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className="text-ink-muted text-sm">{label}</dt>
      <dd className="tabular text-ink text-sm font-medium">{children}</dd>
    </div>
  )
}
