"use client"

import * as React from "react"
import { EyeIcon, EyeOffIcon, LockIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/*
 * Иконка стоит в DOM перед инпутом, поэтому peer-focus здесь не работает —
 * подсветку даёт group-focus-within на обёртке.
 */
const iconClassName =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"

/* Лейблы полей скрыты (sr-only), поэтому ошибку показывает само поле. */
const invalidClassName =
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive"

export interface IconInputProps extends React.ComponentProps<"input"> {
  icon: LucideIcon
}

const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ className, icon: Icon, ...props }, ref) => (
    <div className="group relative">
      <Icon className={iconClassName} aria-hidden="true" />
      <Input
        ref={ref}
        className={cn(invalidClassName, "h-11 pl-10", className)}
        {...props}
      />
    </div>
  )
)
IconInput.displayName = "IconInput"

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  icon?: LucideIcon
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, icon: Icon = LockIcon, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)
    const ToggleIcon = visible ? EyeOffIcon : EyeIcon

    return (
      <div className="group relative">
        <Icon className={iconClassName} aria-hidden="true" />
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(invalidClassName, "h-11 pl-10 pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={props.disabled}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {/* Смена EyeIcon ↔ EyeOffIcon пересоздаёт узел — анимация отыграет. */}
          <ToggleIcon
            className="size-4 animate-in fade-in zoom-in-75"
            aria-hidden="true"
          />
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { IconInput, PasswordInput }
