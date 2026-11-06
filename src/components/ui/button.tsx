import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
const variants=cva('button',{variants:{variant:{default:'primary',outline:'outline',ghost:'ghost',destructive:'danger'},size:{default:'',sm:'small',icon:'icon-button'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}:ComponentProps<'button'>&VariantProps<typeof variants>&{asChild?:boolean}){const Comp=asChild?Slot:'button';return <Comp className={twMerge(clsx(variants({variant,size}),className))} {...props}/>;}
