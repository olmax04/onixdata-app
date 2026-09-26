import Link from "next/link"

import { cn } from "@/lib/utils"

interface AuthAltActionProps {
  question: string
  href: string
  action: string
  className?: string
}

export function AuthAltAction({
  question,
  href,
  action,
  className,
}: AuthAltActionProps) {
  return (
    <p className={cn("text-center text-sm text-muted-foreground", className)}>
      {question}{" "}
      <Link
        href={href}
        className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {action}
      </Link>
    </p>
  )
}
