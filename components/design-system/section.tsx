import * as React from "react"

import { cn } from "@/lib/utils"

interface SectionProps {
  id: string
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}

export function DsSection({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div className="space-y-1.5">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  )
}

interface BlockProps {
  title: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function DsBlock({ title, hint, className, children }: BlockProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? (
          <p className="max-w-3xl text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** Подпись под образцом: имя класса или значение. */
export function DsCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {children}
    </code>
  )
}
