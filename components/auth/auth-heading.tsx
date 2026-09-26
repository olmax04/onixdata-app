import * as React from "react"

import { cn } from "@/lib/utils"

interface AuthHeadingProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Заголовок и подзаголовок — соседние ступени каскада, классы разные. */
  descriptionClassName?: string
}

const AuthHeading = React.forwardRef<HTMLHeadingElement, AuthHeadingProps>(
  ({ className, title, description, descriptionClassName, ...props }, ref) => (
    <div className="space-y-2">
      <h1
        ref={ref}
        className={cn(
          "text-3xl font-semibold tracking-tight outline-none sm:text-[2rem]",
          className
        )}
        {...props}
      >
        {title}
      </h1>
      {description ? (
        <p className={cn("text-sm text-muted-foreground", descriptionClassName)}>
          {description}
        </p>
      ) : null}
    </div>
  )
)
AuthHeading.displayName = "AuthHeading"

export { AuthHeading }
