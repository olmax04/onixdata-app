import { BrandLogo } from "@/components/brand-logo"
import {
  SentimentBadge,
  StatusBadge,
  StatusDot,
} from "@/components/dashboard/badges"
import { MentionsChart } from "@/components/dashboard/mentions-chart"
import { MetricCard } from "@/components/dashboard/metric-card"
import { DsBlock } from "@/components/design-system/section"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { metrics, sources, streamMessages } from "@/lib/mock-data"

export function GalleryData() {
  const rows = streamMessages.slice(0, 4)

  return (
    <>
      <DsBlock
        title="Card"
        hint="rounded-xl, border, bg-card, shadow. Заголовок и описание живут в CardHeader (p-6, space-y-1.5), контент — в CardContent (p-6 pt-0)."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Список источников</CardTitle>
              <CardDescription>
                Каналы, чаты и серверы, подключённые к рабочей области.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Содержимое карточки. Между заголовком и телом отступа нет — его
              задаёт pt-0 у CardContent.
            </CardContent>
            <CardFooter>
              <Button>Сохранить</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Карточка без футера</CardTitle>
              <CardDescription>
                CardFooter нужен только там, где у карточки есть собственное
                действие — например, «Сохранить» в настройках профиля.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Живые примеры MetricCard — в следующем блоке, чтобы не
              дублировать один и тот же спарклайн в DOM.
            </CardContent>
          </Card>
        </div>
      </DsBlock>

      <DsBlock
        title="MetricCard"
        hint="Значение — text-2xl semibold tabular-nums, дельта — коралловая при росте и muted при падении (красного здесь нет). Спарклайн декоративный, обёрнут в aria-hidden."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </DsBlock>

      <DsBlock
        title="Chart"
        hint="ChartContainer + recharts. Заливка area — градиент 0.35 → 0.02 от --chart-1, сетка без вертикалей (strokeDasharray 3 3), оси без линий и засечек."
      >
        <Card>
          <CardHeader>
            <CardTitle>Упоминания по часам</CardTitle>
            <CardDescription>
              Демо-данные за последние 24 часа по всем активным источникам.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MentionsChart />
          </CardContent>
        </Card>
      </DsBlock>

      <DsBlock
        title="Table"
        hint="Обёртка overflow-x-auto, у колонок min-w, числа справа в font-mono tabular-nums. Заголовки колонок — muted-foreground medium, hover строки — bg-muted/50."
      >
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[92px]">Время</TableHead>
                    <TableHead className="min-w-[160px]">Источник</TableHead>
                    <TableHead className="min-w-[120px]">Автор</TableHead>
                    <TableHead className="min-w-[110px] text-right">
                      Сообщений
                    </TableHead>
                    <TableHead className="w-[124px]">Тональность</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {message.time}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {message.source}
                      </TableCell>
                      <TableCell className="text-sm">{message.author}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatNumber(
                          sources.find((source) => source.handle === message.source)?.messages ?? 0
                        )}
                      </TableCell>
                      <TableCell>
                        <SentimentBadge sentiment={message.sentiment} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </DsBlock>

      <DsBlock
        title="Статусы и тональность"
        hint="StatusDot — только маркер, StatusBadge — маркер с подписью, SentimentBadge — тональность сообщения."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <StatusBadge status="active" />
          <StatusBadge status="paused" />
          <StatusBadge status="error" />
          <Separator orientation="vertical" className="h-6" />
          <SentimentBadge sentiment="positive" />
          <SentimentBadge sentiment="neutral" />
          <SentimentBadge sentiment="negative" />
          <Separator orientation="vertical" className="h-6" />
          <StatusDot status="active" />
          <StatusDot status="paused" />
          <StatusDot status="error" />
        </div>
      </DsBlock>

      <DsBlock
        title="Avatar, Progress, Skeleton, Separator, ScrollArea"
        hint="Аватар всегда с инициалами (изображений в прототипе нет). Progress и Skeleton — единственные места, где коралл используется как фон-подложка."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs font-medium">
                  МО
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Максим Орлов</p>
                <p className="truncate text-xs text-muted-foreground">
                  maxim@onixdata.io
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Progress · 64%</p>
              <Progress value={64} />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Skeleton</p>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-xs text-muted-foreground">
              ScrollArea · h-56, как в сайдбаре
            </p>
            <ScrollArea className="h-56 rounded-lg border">
              <ul className="divide-y p-3">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <StatusDot status={source.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {source.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {source.platform} · {source.updatedAt}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="BrandLogo"
        hint="Метка-созвездие + вордмарк: «Onix» жирным, «Data» обычным, точка кораллом. Размеры 26 (по умолчанию) и 30 (auth). markOnly оставляет одну метку и добавляет sr-only «OnixData» — с вордмарком название уже есть в тексте. Ссылка-логотип озвучена в обоих случаях."
      >
        <div className="flex flex-wrap items-center gap-8 rounded-xl border bg-card p-4">
          <div className="flex flex-col items-start gap-2">
            <BrandLogo />
            <span className="font-mono text-xs text-muted-foreground">
              size 26
            </span>
          </div>
          <div className="flex flex-col items-start gap-2">
            <BrandLogo size={30} />
            <span className="font-mono text-xs text-muted-foreground">
              size 30
            </span>
          </div>
          <div className="flex flex-col items-start gap-2">
            <BrandLogo markOnly />
            <span className="font-mono text-xs text-muted-foreground">
              markOnly
            </span>
          </div>
          <div className="flex flex-col items-start gap-2">
            <BrandLogo size={44} markOnly className="text-primary" />
            <span className="font-mono text-xs text-muted-foreground">
              markOnly · text-primary
            </span>
          </div>
        </div>
      </DsBlock>
    </>
  )
}
