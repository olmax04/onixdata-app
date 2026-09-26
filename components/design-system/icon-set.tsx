import {
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LayoutDashboardIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  UploadIcon,
  UserIcon,
  WaypointsIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { DsBlock } from "@/components/design-system/section"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusDot } from "@/components/dashboard/badges"

const icons: { icon: LucideIcon; name: string }[] = [
  { icon: LayoutDashboardIcon, name: "Обзор" },
  { icon: WaypointsIcon, name: "Источники" },
  { icon: RadioIcon, name: "Мониторинг Viber" },
  { icon: SendIcon, name: "Рассылка Viber" },
  { icon: DatabaseIcon, name: "Датасеты" },
  { icon: SettingsIcon, name: "Настройки" },
  { icon: MenuIcon, name: "Меню" },
  { icon: SearchIcon, name: "Поиск" },
  { icon: PlusIcon, name: "Добавить" },
  { icon: BellIcon, name: "Уведомления" },
  { icon: UserIcon, name: "Профиль" },
  { icon: LogOutIcon, name: "Выход" },
  { icon: MoreHorizontalIcon, name: "Действия" },
  { icon: PlayIcon, name: "Возобновить" },
  { icon: PauseIcon, name: "Пауза" },
  { icon: DownloadIcon, name: "Скачать" },
  { icon: UploadIcon, name: "Экспорт" },
  { icon: CopyIcon, name: "Копировать" },
  { icon: Trash2Icon, name: "Удалить" },
  { icon: TrendingUpIcon, name: "Рост" },
  { icon: TrendingDownIcon, name: "Падение" },
  { icon: MailIcon, name: "Email" },
  { icon: LockIcon, name: "Пароль" },
  { icon: EyeIcon, name: "Показать" },
  { icon: EyeOffIcon, name: "Скрыть" },
  { icon: CheckIcon, name: "Выбрано" },
  { icon: ChevronDownIcon, name: "Раскрыть" },
  { icon: ArrowLeftIcon, name: "Назад" },
  { icon: XIcon, name: "Закрыть" },
]

export function IconSet() {
  return (
    <>
      <DsBlock
        title="Размеры"
        hint="Внутри кнопок размер задаёт сам Button через [&_svg]:size-4 — руками его дублировать не нужно."
      >
        <div className="flex flex-wrap items-end gap-6 rounded-xl border bg-card p-4">
          <div className="flex flex-col items-center gap-2">
            <StatusDot status="active" />
            <span className="font-mono text-xs text-muted-foreground">
              size-2
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrendingUpIcon className="size-3 text-primary" aria-hidden="true" />
            <span className="font-mono text-xs text-muted-foreground">
              size-3
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrendingUpIcon
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted-foreground">
              size-3.5
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SettingsIcon className="size-4" aria-hidden="true" />
            <span className="font-mono text-xs text-muted-foreground">
              size-4
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-medium">МО</AvatarFallback>
            </Avatar>
            <span className="font-mono text-xs text-muted-foreground">
              size-8
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailIcon className="size-6" aria-hidden="true" />
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              size-12 / size-6
            </span>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-mono text-xs">size-2</span> — точка статуса;
            <span className="font-mono text-xs"> size-3 / size-3.5</span> —
            иконка тренда и микро-подписи.
          </li>
          <li>
            <span className="font-mono text-xs">size-4</span> — размер по
            умолчанию: кнопки, пункты меню, иконка в поле, навигация.
          </li>
          <li>
            <span className="font-mono text-xs">size-8</span> — аватар,
            <span className="font-mono text-xs"> size-12</span> — круг с иконкой
            на экране успеха.
          </li>
          <li>
            Декоративная иконка получает{" "}
            <span className="font-mono text-xs">aria-hidden=&quot;true&quot;</span>
            ; кнопка без подписи — <span className="font-mono text-xs">aria-label</span>.
          </li>
        </ul>
      </DsBlock>

      <DsBlock
        title="Набор"
        hint="lucide-react, линейный стиль, единая толщина. Иконки берутся из этого набора — смешивать библиотеки нельзя."
      >
        <div className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4 lg:grid-cols-6">
          {icons.map(({ icon: Icon, name }) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="truncate text-xs text-muted-foreground">
                {name}
              </span>
            </div>
          ))}
        </div>
      </DsBlock>
    </>
  )
}
