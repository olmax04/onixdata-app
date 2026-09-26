import { cn } from "@/lib/utils"

interface BrandLogoProps {
  className?: string
  /** Размер метки в пикселях. По умолчанию 26. */
  size?: number
  /** Скрыть вордмарк и показать только метку. */
  markOnly?: boolean
}

export function BrandLogo({
  className,
  size = 26,
  markOnly = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight text-foreground",
        className
      )}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="8" cy="9" r="3" fill="currentColor" />
        <circle cx="24" cy="7" r="2.4" fill="currentColor" opacity=".55" />
        <circle cx="23" cy="23" r="3.4" fill="currentColor" />
        <circle cx="10" cy="24" r="2.2" fill="currentColor" opacity=".55" />
        <path
          d="M8 9L23 23M24 7L10 24M8 9l16-2"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity=".5"
        />
      </svg>
      {!markOnly && (
        <span className="text-[1.05rem] leading-none">
          <b className="font-bold">Onix</b>
          <span className="font-normal">Data</span>
          <span className="text-primary">.</span>
        </span>
      )}
      <span className="sr-only">OnixData</span>
    </span>
  )
}
