import { describe, expect, it } from "vitest"

import {
  campaignToFormState,
  emptyCampaignForm,
  formStateToPatch,
  formStateToPayload,
  minutesToMs,
  validateCampaignForm,
  type CampaignFormState,
} from "@/lib/broadcast-form"
import type { BroadcastCampaign } from "@/lib/viber-parser/types"

const campaign: BroadcastCampaign = {
  id: "campaign_1",
  name: "Вечерняя рассылка",
  groups: [
    { conversationId: 26, name: "Клиенты" },
    { conversationId: 31, name: "Партнёры" },
  ],
  messages: ["Первый текст", "Второй текст"],
  intervalMs: 120_000,
  minIntervalPerChatMs: 1_800_000,
  rotation: "shuffle-cycle",
  loop: true,
  activeFrom: "09:00",
  activeTo: "21:00",
  status: "stopped",
  nextGroupIndex: 0,
  rotationState: [],
  sentCount: 4,
  failedCount: 1,
  lastError: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  startedAt: null,
  stoppedAt: null,
}

const names = new Map<number, string>([
  [26, "Клиенты"],
  [31, "Партнёры"],
  [42, "Новые"],
])

describe("campaignToFormState", () => {
  it("раскладывает кампанию в поля формы", () => {
    expect(campaignToFormState(campaign)).toEqual({
      name: "Вечерняя рассылка",
      conversationIds: [26, 31],
      messages: ["Первый текст", "Второй текст"],
      intervalMinutes: "2",
      cooldownMinutes: "30",
      activeFrom: "09:00",
      activeTo: "21:00",
      rotation: "shuffle-cycle",
      loop: true,
    } satisfies CampaignFormState)
  })

  it("переводит паузы в минуты без потери точности", () => {
    const state = campaignToFormState({
      ...campaign,
      intervalMs: 100_000,
      minIntervalPerChatMs: 5_000,
    })
    expect(minutesToMs(state.intervalMinutes)).toBe(100_000)
    expect(minutesToMs(state.cooldownMinutes)).toBe(5_000)
    expect(validateCampaignForm(state)).toBeNull()
  })

  it("показывает круглосуточную рассылку пустыми часами", () => {
    const state = campaignToFormState({ ...campaign, activeFrom: null, activeTo: null })
    expect(state.activeFrom).toBe("")
    expect(state.activeTo).toBe("")
  })
})

describe("validateCampaignForm", () => {
  const valid = campaignToFormState(campaign)

  it("пропускает корректную форму", () => {
    expect(validateCampaignForm(valid)).toBeNull()
  })

  it("требует хотя бы одну группу", () => {
    expect(validateCampaignForm({ ...valid, conversationIds: [] })).toMatch(/группу/i)
  })

  it("требует хотя бы один текст", () => {
    expect(validateCampaignForm({ ...valid, messages: ["   ", ""] })).toMatch(/текст/i)
  })

  it("не разрешает паузу меньше минуты", () => {
    expect(validateCampaignForm({ ...valid, intervalMinutes: "0" })).toMatch(/не меньше 1 минуты/i)
    expect(validateCampaignForm({ ...valid, intervalMinutes: "" })).toMatch(/не меньше 1 минуты/i)
  })

  it("не разрешает паузу для чата меньше минуты", () => {
    expect(validateCampaignForm({ ...valid, cooldownMinutes: "0" })).toMatch(/не меньше 1 минуты/i)
  })

  it("разрешает пустые рабочие часы как круглосуточную рассылку", () => {
    expect(validateCampaignForm({ ...valid, activeFrom: "", activeTo: "" })).toBeNull()
  })

  it("не разрешает заполнить только одну границу рабочих часов", () => {
    expect(validateCampaignForm({ ...valid, activeTo: "" })).toMatch(/рабочие часы/i)
  })
})

describe("formStateToPayload", () => {
  it("собирает тело запроса и подставляет известные имена групп", () => {
    const state: CampaignFormState = {
      ...emptyCampaignForm(),
      name: "  Утренняя  ",
      conversationIds: [26, 42],
      messages: ["  Привет  ", "   ", " Ещё текст "],
      intervalMinutes: "2",
      cooldownMinutes: "30",
      activeFrom: "09:00",
      activeTo: "21:00",
      rotation: "round-robin",
      loop: false,
    }

    expect(formStateToPayload(state, names)).toEqual({
      name: "Утренняя",
      conversationIds: [26, 42],
      groupNames: { "26": "Клиенты", "42": "Новые" },
      messages: ["Привет", "Ещё текст"],
      intervalMs: 120_000,
      minIntervalPerChatMs: 1_800_000,
      rotation: "round-robin",
      loop: false,
      activeFrom: "09:00",
      activeTo: "21:00",
    })
  })

  it("сохраняет переносы строк внутри одного поля и отбрасывает пустые", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      messages: ["Привет,\n\nэто один текст", "  ", "\n", " Второй "],
    }

    expect(formStateToPayload(state, names).messages).toEqual([
      "Привет,\n\nэто один текст",
      "Второй",
    ])
  })

  it("не передаёт пустое имя и шлёт null для круглосуточной рассылки", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      name: "   ",
      activeFrom: "",
      activeTo: "",
    }
    const payload = formStateToPayload(state, names)
    expect(payload.name).toBeUndefined()
    expect(payload.activeFrom).toBeNull()
    expect(payload.activeTo).toBeNull()
  })
})

describe("formStateToPatch", () => {
  it("возвращает пустой патч, когда ничего не изменилось", () => {
    expect(formStateToPatch(campaignToFormState(campaign), campaign, names)).toEqual({})
  })

  it("включает только изменённые поля", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      name: "Другое имя",
      intervalMinutes: "5",
    }
    expect(formStateToPatch(state, campaign, names)).toEqual({
      name: "Другое имя",
      intervalMs: 300_000,
    })
  })

  it("передаёт имена групп вместе с новым списком бесед", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      conversationIds: [31, 42],
    }
    expect(formStateToPatch(state, campaign, names)).toEqual({
      conversationIds: [31, 42],
      groupNames: { "31": "Партнёры", "42": "Новые" },
    })
  })

  it("не шлёт нетронутые паузы, которые не делятся на минуту", () => {
    const dirty: BroadcastCampaign = {
      ...campaign,
      intervalMs: 100_000,
      minIntervalPerChatMs: 5_000,
    }
    expect(formStateToPatch(campaignToFormState(dirty), dirty, names)).toEqual({})
  })

  it("считает порядок бесед незначимым", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      conversationIds: [31, 26],
    }
    expect(formStateToPatch(state, campaign, names)).toEqual({})
  })

  it("сбрасывает рабочие часы в null", () => {
    const state: CampaignFormState = {
      ...campaignToFormState(campaign),
      activeFrom: "",
      activeTo: "",
    }
    expect(formStateToPatch(state, campaign, names)).toEqual({
      activeFrom: null,
      activeTo: null,
    })
  })

  it("не затирает имя, когда поле очистили", () => {
    const state: CampaignFormState = { ...campaignToFormState(campaign), name: "  " }
    expect(formStateToPatch(state, campaign, names)).toEqual({})
  })
})
