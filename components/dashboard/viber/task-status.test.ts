import { describe, expect, it } from "vitest"

import { terminalToastOf } from "@/components/dashboard/viber/task-status"
import type { TerminalTaskInfo } from "@/lib/viber-parser/parser-sync"
import type { TaskCollectionResultDto } from "@/lib/viber-parser/types"

const collected: TaskCollectionResultDto = {
  group: "АVTOTRAL",
  conversationId: 26,
  pagesCount: 5,
  participantsCount: 900,
  participantsWithPhone: 640,
  savedJsonPath: "a.json",
  savedTxtPath: "a.txt",
}

function info(overrides: Partial<TerminalTaskInfo> = {}): TerminalTaskInfo {
  return {
    taskId: "task_1",
    status: "ready",
    groupName: "АVTOTRAL",
    result: null,
    error: null,
    ...overrides,
  }
}

describe("terminalToastOf", () => {
  it("показывает числа, когда итоги задачи уже известны", () => {
    expect(terminalToastOf(info({ result: collected }))).toEqual({
      kind: "success",
      title: "Сбор участников успешно завершен!",
      description: "Собрано: 900, с номерами: 640",
    })
  })

  it("без итогов не подставляет нули", () => {
    // Терминал по SSE приходит без result: числа брать неоткуда.
    const notice = terminalToastOf(info({ result: null }))

    expect(notice.kind).toBe("success")
    expect(notice.title).toBe("Сбор участников завершён")
    expect(notice.description).toBe("Итоги появятся в карточке задачи после обновления")
    expect(notice.description).not.toMatch(/\d/)
  })

  it("остановку показывает без описания", () => {
    expect(terminalToastOf(info({ status: "stopped" }))).toEqual({
      kind: "info",
      title: "Сбор остановлен пользователем",
    })
  })

  it("ошибку показывает с текстом бэкенда", () => {
    expect(terminalToastOf(info({ status: "error", error: "Frida отвалилась" }))).toEqual({
      kind: "error",
      title: "Ошибка при выполнении задачи",
      description: "Frida отвалилась",
    })
  })

  it("ошибку без текста показывает без описания", () => {
    expect(terminalToastOf(info({ status: "error" })).description).toBeUndefined()
  })
})
