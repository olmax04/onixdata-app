import { DsBlock, DsCode } from "@/components/design-system/section"
import { Badge } from "@/components/ui/badge"
import {
  SentimentBadge,
  StatusBadge,
  StatusDot,
} from "@/components/dashboard/badges"
import {
  alphaTokens,
  sentimentSemantics,
  statusSemantics,
  tokenGroups,
  type DesignToken,
} from "@/lib/design-tokens"

function Swatch({ token }: { token: DesignToken }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <span
        aria-hidden="true"
        className="mt-0.5 size-10 shrink-0 rounded-md border"
        style={{ backgroundColor: `hsl(var(${token.name}))` }}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-mono text-xs font-medium">{token.name}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {token.hex} · hsl({token.hsl})
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {token.tailwind}
        </p>
        <p className="text-xs text-muted-foreground">{token.usage}</p>
      </div>
    </div>
  )
}

export function ColorSwatches() {
  return (
    <>
      {tokenGroups.map((group) => (
        <DsBlock key={group.id} title={group.title} hint={group.description}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.tokens.map((token) => (
              <Swatch key={token.name} token={token} />
            ))}
          </div>
        </DsBlock>
      ))}

      <DsBlock
        title="Семантика статусов"
        hint="Источник может быть активен, на паузе или в ошибке. Коралл достаётся только активному."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {statusSemantics.map((row) => (
            <div key={row.key} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={row.key} />
                <DsCode>{row.value}</DsCode>
              </div>
              <p className="text-xs text-muted-foreground">{row.rule}</p>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Тональность сообщений"
        hint="В системе нет зелёного success и жёлтого warning: позитив выражается кораллом, негатив — нейтрально, ошибка — destructive. Исключение — панели Viber: состояния бэкенда там показаны статусными цветами Tailwind (emerald/amber/blue/indigo)."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {sentimentSemantics.map((row) => (
            <div key={row.key} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <SentimentBadge sentiment={row.key} />
                <DsCode>{row.value}</DsCode>
              </div>
              <p className="text-xs text-muted-foreground">{row.rule}</p>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Точки статуса"
        hint="StatusDot — декоративный маркер size-2, всегда с aria-hidden. Смысл несёт текст рядом."
      >
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 text-sm">
          <span className="flex items-center gap-2">
            <StatusDot status="active" />
            Активен
          </span>
          <span className="flex items-center gap-2">
            <StatusDot status="paused" />
            На паузе
          </span>
          <span className="flex items-center gap-2">
            <StatusDot status="error" />
            Ошибка
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-primary" />
            в эфире (animate-pulse) — панели Viber
          </span>
        </div>
      </DsBlock>

      <DsBlock
        title="Прозрачности"
        hint="Список закрыт: новые ступени не заводим, берём из этого набора."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {alphaTokens.map((alpha) => (
            <div
              key={alpha.value}
              className="space-y-1 rounded-lg border bg-card p-3"
            >
              <p className="font-mono text-xs">{alpha.value}</p>
              <p className="text-xs text-muted-foreground">{alpha.usage}</p>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Коралл в деле"
        hint="Плотность акцента на экране — примерно как здесь: одна заливка на блок, остальное нейтраль."
      >
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
          <Badge>Позитив</Badge>
          <Badge variant="secondary">Нейтрально</Badge>
          <Badge variant="outline">Негатив</Badge>
          <Badge variant="destructive">Ошибка</Badge>
          <span className="text-sm text-primary">Ссылка в auth</span>
          <span className="text-sm text-muted-foreground">
            Второстепенный текст
          </span>
        </div>
      </DsBlock>
    </>
  )
}
