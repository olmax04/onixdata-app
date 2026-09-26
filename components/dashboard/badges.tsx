import { Badge } from "@/components/ui/badge"
import {
  sentimentLabels,
  sourceStatusLabels,
  type Sentiment,
  type SourceStatus,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/**
 * Коралловый (primary) держим только за позитивной тональностью,
 * чтобы бренд-акцент не расползался по интерфейсу.
 */
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === "positive") {
    return <Badge>{sentimentLabels.positive}</Badge>
  }
  if (sentiment === "negative") {
    return <Badge variant="outline">{sentimentLabels.negative}</Badge>
  }
  return <Badge variant="secondary">{sentimentLabels.neutral}</Badge>
}

const statusDotClass: Record<SourceStatus, string> = {
  active: "bg-primary",
  paused: "bg-muted-foreground",
  error: "bg-destructive",
}

export function StatusDot({
  status,
  className,
}: {
  status: SourceStatus
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        statusDotClass[status],
        className
      )}
    />
  )
}

export function StatusBadge({ status }: { status: SourceStatus }) {
  return (
    <Badge
      variant={status === "error" ? "destructive" : "secondary"}
      className="gap-1.5 font-medium"
    >
      {status !== "error" && <StatusDot status={status} />}
      {sourceStatusLabels[status]}
    </Badge>
  )
}
