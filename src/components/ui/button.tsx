import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-tomato text-white hover:bg-tomato-strong',
        secondary: 'bg-paper-sunken text-ink hover:bg-rule',
        outline: 'border border-rule bg-paper-raised text-ink hover:bg-paper-sunken',
        ghost: 'text-ink-muted hover:bg-paper-sunken hover:text-ink',
        danger: 'border border-tomato text-tomato hover:bg-tomato-soft',
      },
      size: {
        // 44 px minimum touch target on phones.
        default: 'h-11 px-5',
        sm: 'h-9 px-3.5 text-[0.8125rem]',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
