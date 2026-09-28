"use client"

import * as React from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BroadcastCampaignForm,
  type BroadcastGroupRow,
} from "@/components/dashboard/broadcast-campaign-form"
import {
  campaignToFormState,
  formatBroadcastTime,
  formStateToPatch,
  hoursLabel,
  STATUS_LABELS,
  validateCampaignForm,
  type CampaignFormState,
} from "@/lib/broadcast-form"
import { viberJson } from "@/lib/viber-parser/client"
import type { BroadcastCampaign } from "@/lib/viber-parser/types"

export interface BroadcastCampaignDialogProps {
  campaign: BroadcastCampaign | null
  deviceId?: string
  groupRows: BroadcastGroupRow[]
  loadingGroups?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}

export function BroadcastCampaignDialog({
  campaign,
  deviceId,
  groupRows,
  loadingGroups = false,
  open,
  onOpenChange,
  onSaved,
}: BroadcastCampaignDialogProps) {
  const [draft, setDraft] = React.useState<{ id: string; state: CampaignFormState } | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) setDraft(null)
  }, [open])

  // Считаем поля прямо в рендере: правки живут в draft, а при смене кампании
  // сразу берём её собственные значения, без кадра с чужими данными.
  const form: CampaignFormState | null = !campaign
    ? null
    : draft?.id === campaign.id
      ? draft.state
      : campaignToFormState(campaign)

  const setForm = (next: CampaignFormState) => {
    if (!campaign) return
    setDraft({ id: campaign.id, state: next })
  }

  const readOnly = campaign?.status === "running"

  const knownNames = React.useMemo(() => {
    const names = new Map<number, string>()
    for (const group of campaign?.groups ?? []) {
      if (group.name) names.set(group.conversationId, group.name)
    }
    for (const row of groupRows) names.set(row.conversationId, row.name)
    return names
  }, [campaign?.groups, groupRows])

  const handleSave = async () => {
    if (!campaign || !form) return
    const error = validateCampaignForm(form)
    if (error) {
      toast.error(error)
      return
    }

    const patch = formStateToPatch(form, campaign, knownNames)
    if (Object.keys(patch).length === 0) {
      toast.info("Изменений нет")
      return
    }

    setSaving(true)
    try {
      const params = new URLSearchParams()
      if (deviceId) params.set("deviceId", deviceId)
      const query = params.toString()
      const path = `broadcast/campaigns/${campaign.id}${query ? `?${query}` : ""}`
      await viberJson<BroadcastCampaign>(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      toast.success("Кампания обновлена")
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error("Не удалось сохранить изменения", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {campaign && form ? (
          // Пересобираем содержимое при смене кампании, чтобы первый кадр не
          // показал поля предыдущей.
          <React.Fragment key={campaign.id}>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {campaign.name}
                <Badge
                  variant={
                    campaign.status === "error"
                      ? "destructive"
                      : campaign.status === "running"
                        ? "default"
                        : "secondary"
                  }
                  className="font-normal"
                >
                  {STATUS_LABELS[campaign.status]}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {readOnly
                  ? "Остановите рассылку, чтобы изменить"
                  : "Измените параметры и тексты — рассылка подхватит их при следующем запуске."}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Отправлено</dt>
                <dd className="font-mono tabular-nums">{campaign.sentCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ошибок</dt>
                <dd className="font-mono tabular-nums">{campaign.failedCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Рабочие часы</dt>
                <dd>{hoursLabel(campaign.activeFrom, campaign.activeTo)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Создана</dt>
                <dd>{formatBroadcastTime(campaign.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Запущена</dt>
                <dd>{formatBroadcastTime(campaign.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Остановлена</dt>
                <dd>{formatBroadcastTime(campaign.stoppedAt)}</dd>
              </div>
            </dl>

            {campaign.lastError ? (
              <p className="text-xs text-destructive">{campaign.lastError}</p>
            ) : null}

            {campaign.rotationState.some((state) => state.sendCount > 0) ? (
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-xs font-medium">Отправлено по чатам</p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {campaign.rotationState.map((state) => {
                    const group = campaign.groups.find(
                      (item) => item.conversationId === state.conversationId
                    )
                    return (
                      <li key={state.conversationId}>
                        {group?.name || `ID ${state.conversationId}`} — {state.sendCount}
                        {state.lastMessageIndex === null
                          ? ""
                          : `, последний вариант №${state.lastMessageIndex + 1}`}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            <BroadcastCampaignForm
              idPrefix={`broadcast-edit-${campaign.id}`}
              value={form}
              onChange={setForm}
              groupRows={groupRows}
              loadingGroups={loadingGroups}
              readOnly={readOnly}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
              <Button
                className="gap-1.5"
                disabled={readOnly || saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          </React.Fragment>
        ) : (
          <DialogHeader>
            <DialogTitle className="text-base">Кампания</DialogTitle>
            <DialogDescription className="text-xs">Кампания не выбрана.</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
