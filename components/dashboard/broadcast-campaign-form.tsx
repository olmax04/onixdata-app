"use client"

import * as React from "react"
import { PlusIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  cleanMessages,
  ROTATION_LABELS,
  variantCountLabel,
  type CampaignFormState,
} from "@/lib/broadcast-form"
import type { BroadcastRotation } from "@/lib/viber-parser/types"

export interface BroadcastGroupRow {
  conversationId: number
  name: string
  memberCount?: number
}

export interface BroadcastCampaignFormProps {
  /** Префикс id полей — на странице одновременно живут форма создания и диалог. */
  idPrefix: string
  value: CampaignFormState
  onChange: (next: CampaignFormState) => void
  groupRows: BroadcastGroupRow[]
  loadingGroups?: boolean
  /** Кампанию нельзя менять, пока она идёт. */
  readOnly?: boolean
}

export function BroadcastCampaignForm({
  idPrefix,
  value,
  onChange,
  groupRows,
  loadingGroups = false,
  readOnly = false,
}: BroadcastCampaignFormProps) {
  const [groupQuery, setGroupQuery] = React.useState("")

  const selectedIds = React.useMemo(
    () => new Set(value.conversationIds),
    [value.conversationIds]
  )

  const visibleGroups = React.useMemo(() => {
    const query = groupQuery.trim().toLowerCase()
    if (!query) return groupRows
    return groupRows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) || String(row.conversationId).includes(query)
    )
  }, [groupRows, groupQuery])

  const patch = (changes: Partial<CampaignFormState>) => {
    onChange({ ...value, ...changes })
  }

  const toggleGroup = (conversationId: number, checked: boolean) => {
    const next = new Set(value.conversationIds)
    if (checked) next.add(conversationId)
    else next.delete(conversationId)
    patch({ conversationIds: Array.from(next) })
  }

  // Пустой список рисуем как одно пустое поле — форме всегда есть куда печатать.
  const messages = value.messages.length > 0 ? value.messages : [""]

  const setMessage = (index: number, text: string) => {
    patch({ messages: messages.map((item, at) => (at === index ? text : item)) })
  }

  const addMessage = () => {
    patch({ messages: [...messages, ""] })
  }

  const removeMessage = (index: number) => {
    const next = messages.filter((_, at) => at !== index)
    patch({ messages: next.length > 0 ? next : [""] })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Название</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Вечерняя рассылка"
          className="h-9 text-sm"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-groups-search`}>Группы</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${idPrefix}-groups-search`}
            value={groupQuery}
            onChange={(event) => setGroupQuery(event.target.value)}
            placeholder="Поиск группы…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <ScrollArea className="h-52 rounded-lg border">
          {loadingGroups && groupRows.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Загрузка групп…</p>
          ) : visibleGroups.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Группы не найдены.</p>
          ) : (
            <ul className="divide-y">
              {visibleGroups.map((row) => (
                <li key={row.conversationId}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1">
                    <Checkbox
                      checked={selectedIds.has(row.conversationId)}
                      onCheckedChange={(checked) =>
                        toggleGroup(row.conversationId, checked === true)
                      }
                      aria-label={row.name}
                      disabled={readOnly}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ID {row.conversationId}
                        {typeof row.memberCount === "number"
                          ? ` · ${row.memberCount.toLocaleString("ru-RU")} уч.`
                          : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <p className="text-[11px] text-muted-foreground">
          Выбрано: {selectedIds.size} из {groupRows.length}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-message-0`}>Тексты сообщений</Label>
        <div className="space-y-2">
          {messages.map((text, index) => (
            <div key={index} className="flex items-start gap-2">
              <Textarea
                id={`${idPrefix}-message-${index}`}
                aria-label={`Текст ${index + 1}`}
                value={text}
                onChange={(event) => setMessage(index, event.target.value)}
                placeholder="Добрый день! Актуальное расписание на сегодня."
                className="min-h-20 text-sm"
                disabled={readOnly}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить текст ${index + 1}`}
                onClick={() => removeMessage(index)}
                disabled={readOnly}
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={addMessage}
          disabled={readOnly}
        >
          <PlusIcon />
          Добавить текст
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {variantCountLabel(cleanMessages(messages).length)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-interval`}>Пауза, мин</Label>
          <Input
            id={`${idPrefix}-interval`}
            type="number"
            min={1}
            step={1}
            value={value.intervalMinutes}
            onChange={(event) => patch({ intervalMinutes: event.target.value })}
            className="h-9 text-sm"
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cooldown`}>На чат, мин</Label>
          <Input
            id={`${idPrefix}-cooldown`}
            type="number"
            min={1}
            step={1}
            value={value.cooldownMinutes}
            onChange={(event) => patch({ cooldownMinutes: event.target.value })}
            className="h-9 text-sm"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-from`}>Рабочие часы с</Label>
          <Input
            id={`${idPrefix}-from`}
            type="time"
            value={value.activeFrom}
            onChange={(event) => patch({ activeFrom: event.target.value })}
            className="h-9 text-sm"
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-to`}>по</Label>
          <Input
            id={`${idPrefix}-to`}
            type="time"
            value={value.activeTo}
            onChange={(event) => patch({ activeTo: event.target.value })}
            className="h-9 text-sm"
            disabled={readOnly}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        По местному времени компьютера. Вне этого окна рассылка ждёт и не пишет в чаты.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rotation`}>Порядок текстов</Label>
        <Select
          value={value.rotation}
          onValueChange={(next) => patch({ rotation: next as BroadcastRotation })}
          disabled={readOnly}
        >
          <SelectTrigger id={`${idPrefix}-rotation`} className="h-9 text-sm" aria-label="Порядок текстов">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROTATION_LABELS).map(([option, label]) => (
              <SelectItem key={option} value={option}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3">
        <div>
          <p className="text-sm font-medium">Повторять по кругу</p>
          <p className="text-[11px] text-muted-foreground">
            Выкл — по одному сообщению в каждую группу и стоп
          </p>
        </div>
        <Switch
          checked={value.loop}
          onCheckedChange={(checked) => patch({ loop: checked })}
          aria-label="Повторять по кругу"
          disabled={readOnly}
        />
      </div>
    </div>
  )
}
