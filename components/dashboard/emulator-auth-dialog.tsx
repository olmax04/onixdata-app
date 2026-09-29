"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  Loader2Icon,
  PhoneIncomingIcon,
  QrCodeIcon,
  SmartphoneIcon,
  RotateCcwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useEmulators } from "@/lib/emulators-context"
import {
  QR_POLL_INTERVAL_MS,
  describeQrStatus,
  isQrSessionLive,
  qrImageSource,
  type QrAuthStatus,
} from "@/lib/viber-qr"

type AuthMode = "sms" | "qr"

/** Как Viber подтверждает номер: звонком (код — хвост номера звонящего) или SMS. */
type Verification = "call" | "sms"

interface PhoneStepResult {
  success?: boolean
  message?: string
  verification?: Verification
  codeLength?: number | null
}

const TONE_CLASSES: Record<string, string> = {
  neutral: "text-muted-foreground",
  info: "text-purple-600 dark:text-purple-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
}

interface EmulatorAuthDialogProps {
  emulator: {
    id: string
    name: string
    adbSerial?: string | null
    scrcpyUrl?: string | null
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onOpenScreen?: () => void
}

export function EmulatorAuthDialog({
  emulator,
  open,
  onOpenChange,
  onSuccess,
  onOpenScreen,
}: EmulatorAuthDialogProps) {
  const { refresh: refreshEmulators } = useEmulators()
  const [mode, setMode] = React.useState<AuthMode>("sms")
  const [step, setStep] = React.useState<"phone" | "code" | "success">("phone")
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [clearData, setClearData] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [userName, setUserName] = React.useState("Milena")
  const [loading, setLoading] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [qrStatus, setQrStatus] = React.useState<QrAuthStatus | null>(null)
  const [verification, setVerification] = React.useState<Verification | null>(null)
  const [codeLength, setCodeLength] = React.useState<number | null>(null)
  const [codeHint, setCodeHint] = React.useState<string | null>(null)
  const [calling, setCalling] = React.useState(false)

  const deviceId = emulator?.adbSerial || undefined

  // Reset state when opening with a new emulator
  React.useEffect(() => {
    if (open) {
      setMode("sms")
      setStep("phone")
      setPhoneNumber("")
      setCode("")
      setUserName("Milena")
      setClearData(false)
      setStatusMessage(null)
      setLoading(false)
      setQrStatus(null)
      setVerification(null)
      setCodeLength(null)
      setCodeHint(null)
      setCalling(false)
    }
  }, [open, emulator?.id])

  const applyPhoneStep = (data: PhoneStepResult) => {
    setVerification(data.verification ?? null)
    setCodeLength(typeof data.codeLength === "number" && data.codeLength > 0 ? data.codeLength : null)
    setCodeHint(data.message ?? null)
  }

  // --- Вход по QR-коду ---------------------------------------------------

  const qrLive = qrStatus !== null && isQrSessionLive(qrStatus.state)

  /**
   * Пока сессия жива, статус опрашивается раз в пару секунд: Viber может
   * заменить код, а сам факт сканирования виден только по смене состояния.
   */
  React.useEffect(() => {
    if (!open || mode !== "qr" || !qrLive) return

    let cancelled = false
    const poll = async () => {
      try {
        const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""
        const res = await fetch(`/api/viber/auth/qr/status${query}`, { cache: "no-store" })
        const data = (await res.json()) as QrAuthStatus
        if (cancelled || !res.ok) return
        // Опрос, выстреливший до отказа старта, не должен затирать уже
        // показанную ошибку: завершённое состояние обновлениям не подлежит.
        setQrStatus((previous) =>
          previous === null || isQrSessionLive(previous.state) ? data : previous,
        )
      } catch {
        // Одна неудачная попытка опроса — не повод рвать сессию: следующая
        // через пару секунд, а последнее известное состояние остаётся на экране.
      }
    }

    const timer = setInterval(() => void poll(), QR_POLL_INTERVAL_MS)
    void poll()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, mode, qrLive, deviceId])

  React.useEffect(() => {
    if (qrStatus?.state !== "ready") return
    toast.success("Авторизация успешна!", {
      description: "Viber подключён как второе устройство",
    })
    setStep("success")
    void refreshEmulators()
    const timer = setTimeout(() => {
      onOpenChange(false)
      onSuccess?.()
    }, 1800)
    return () => clearTimeout(timer)
  }, [qrStatus?.state, refreshEmulators, onOpenChange, onSuccess])

  const handleShowQr = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPhone = phoneNumber.trim()
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Введите номер телефона аккаунта Viber с кодом страны (например, +48794034881)")
      return
    }

    setLoading(true)
    setQrStatus({ state: "starting" })
    try {
      const res = await fetch("/api/viber/auth/qr/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleanPhone, deviceId, clearData }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || "Не удалось открыть QR-код")
      }
      setQrStatus({ state: "starting" })
    } catch (err: any) {
      setQrStatus({ state: "error", error: err.message || String(err) })
      toast.error("Ошибка авторизации", { description: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  const stopQrSession = React.useCallback(async () => {
    try {
      await fetch("/api/viber/auth/qr/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })
    } catch {
      // Устройство освободится по таймауту сессии, ругаться на пользователя незачем.
    }
    setQrStatus(null)
  }, [deviceId])

  const handleCloseDialog = async () => {
    // Сессия держит эмулятор занятым, поэтому закрытие окна её останавливает.
    if (qrLive) await stopQrSession()
    onOpenChange(false)
  }

  const handleSendPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPhone = phoneNumber.trim()
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Введите корректный номер телефона с кодом страны (например, +48794034881)")
      return
    }

    setLoading(true)
    setStatusMessage("Ввод номера, запрос звонка и выдача разрешений Viber...")
    try {
      const res = await fetch("/api/viber/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          deviceId: emulator?.adbSerial || undefined,
          clearData,
        }),
      })

      const data = (await res.json()) as PhoneStepResult
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Не удалось отправить номер")
      }

      applyPhoneStep(data)
      toast.success(data.verification === "call" ? "Viber звонит на ваш номер" : "Номер отправлен!", {
        description: data.message || "Ожидайте SMS-код или звонок с подтверждением",
      })
      setStep("code")
      setStatusMessage(null)
    } catch (err: any) {
      toast.error("Ошибка авторизации", {
        description: err.message || String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRequestCall = async () => {
    setCalling(true)
    try {
      const res = await fetch("/api/viber/auth/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: emulator?.adbSerial || undefined }),
      })
      const data = (await res.json()) as PhoneStepResult
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Не удалось запросить звонок")
      }
      applyPhoneStep(data)
      toast.success("Звонок запрошен", { description: data.message })
    } catch (err: any) {
      toast.error("Звонок не запрошен", { description: err.message || String(err) })
    } finally {
      setCalling(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = code.trim().replace(/\D/g, "")
    const minLength = codeLength ?? 4
    if (!cleanCode || cleanCode.length < minLength) {
      const digits = codeLength ? `последние ${codeLength} цифры` : "последние цифры"
      toast.error(
        verification === "call"
          ? `Введите ${digits} номера, с которого звонил Viber`
          : "Введите код подтверждения (минимум 4-6 цифр)"
      )
      return
    }

    setLoading(true)
    setStatusMessage("Ввод кода подтверждения...")
    try {
      const res = await fetch("/api/viber/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          deviceId: emulator?.adbSerial || undefined,
          userName: userName.trim() || "Milena",
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Не удалось подтвердить код")
      }

      toast.success("Авторизация успешна!", {
        description: data.message || "Сессия Viber успешно активирована",
      })
      setStep("success")
      setStatusMessage(null)
      // Сразу обновляем общий список инстансов, чтобы новый аккаунт Viber
      // появился в боковой панели, не дожидаясь очередного опроса.
      void refreshEmulators()

      setTimeout(() => {
        onOpenChange(false)
        onSuccess?.()
      }, 1800)
    } catch (err: any) {
      toast.error("Ошибка подтверждения кода", {
        description: err.message || String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  if (!emulator) return null

  return (
    <Dialog
      open={open}
      // Esc, крестик и клик мимо окна закрывают диалог в обход кнопки «Отменить».
      // Живая QR-сессия при этом держит deviceMutex до самого таймаута и блокирует
      // всё остальное на эмуляторе, поэтому любое закрытие идёт через общий путь.
      onOpenChange={(next) => {
        if (next) onOpenChange(true)
        else void handleCloseDialog()
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <KeyRoundIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Авторизация в Viber</DialogTitle>
              <DialogDescription>
                Инстанс: <span className="font-semibold text-foreground">{emulator.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step !== "success" && (
          <div
            role="tablist"
            aria-label="Способ авторизации"
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "sms"}
              onClick={() => setMode("sms")}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "sms" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <SmartphoneIcon className="h-3.5 w-3.5" />
              По SMS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "qr"}
              onClick={() => setMode("qr")}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "qr" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <QrCodeIcon className="h-3.5 w-3.5" />
              По QR-коду
            </button>
          </div>
        )}

        {step !== "success" && mode === "qr" && (
          <QrAuthPanel
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            clearData={clearData}
            onClearDataChange={setClearData}
            loading={loading}
            status={qrStatus}
            onSubmit={handleShowQr}
            onCancelSession={stopQrSession}
            onClose={handleCloseDialog}
            onOpenScreen={onOpenScreen}
          />
        )}

        {step === "phone" && mode === "sms" && (
          <form onSubmit={handleSendPhone} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефона Viber</Label>
              <div className="relative">
                <Input
                  id="phone"
                  placeholder="+48794034881 или +380501234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                  autoFocus
                  className="font-mono text-base tracking-wide"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Панель введёт номер в Viber, нажмёт «Позвонить мне» и выдаст приложению все
                разрешения. Останется ввести последние цифры номера, с которого позвонит Viber.
              </p>
            </div>

            <div className="flex items-start space-x-2 pt-1">
              <Checkbox
                id="clearData"
                checked={clearData}
                onCheckedChange={(checked) => setClearData(checked === true)}
                disabled={loading}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="clearData"
                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Сбросить данные Viber перед вводом (чистый вход)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Очистит данные предыдущей сессии перед началом авторизации.
                </p>
              </div>
            </div>

            {statusMessage && (
              <div className="p-3 bg-muted/60 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin text-purple-600" />
                <span>{statusMessage}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить номер"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "code" && mode === "sms" && (
          <form onSubmit={handleSendCode} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Номер:</span>
                <span className="font-mono font-bold text-foreground">{phoneNumber}</span>
              </div>
              {verification === "call" ? (
                <p className="flex items-start gap-1.5 text-[11px] text-foreground">
                  <PhoneIncomingIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                  <span>
                    {codeHint ||
                      "Viber звонит на этот номер. Введите последние цифры номера, с которого поступил звонок."}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px]">
                  {codeHint || "Введите полученный SMS-код или цифры из проверочного звонка."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">
                {verification === "call"
                  ? codeLength
                    ? `Последние ${codeLength} цифры номера звонящего`
                    : "Последние цифры номера звонящего"
                  : "Код подтверждения (SMS / звонок)"}
              </Label>
              <Input
                id="code"
                inputMode="numeric"
                placeholder={codeLength ? "0".repeat(codeLength) : verification === "call" ? "0000" : "123456"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                autoFocus
                maxLength={codeLength ?? 8}
                className="font-mono text-xl tracking-[0.3em] text-center font-bold"
              />
              <p className="text-[11px] text-muted-foreground">
                После подтверждения панель сама закроет запросы разрешений и предложения бэкапа.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userName" className="text-xs text-muted-foreground">
                Имя профиля бота (если спросит при первом входе)
              </Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={loading}
                className="text-xs"
              />
            </div>

            {statusMessage && (
              <div className="p-3 bg-muted/60 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin text-purple-600" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  disabled={loading || calling}
                  className="text-purple-600 hover:underline flex items-center gap-1"
                >
                  <RotateCcwIcon className="h-3 w-3" />
                  Изменить номер
                </button>
                <button
                  type="button"
                  onClick={() => void handleRequestCall()}
                  disabled={loading || calling}
                  className="text-purple-600 hover:underline flex items-center gap-1"
                >
                  {calling ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : (
                    <PhoneIncomingIcon className="h-3 w-3" />
                  )}
                  Позвонить ещё раз
                </button>
              </div>

              {onOpenScreen && (
                <button
                  type="button"
                  onClick={onOpenScreen}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 underline"
                >
                  <SmartphoneIcon className="h-3 w-3" />
                  Открыть экран устройства
                </button>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Подтверждение...
                  </>
                ) : (
                  "Подтвердить код"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "success" && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2Icon className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Авторизация успешно завершена!</h3>
              <p className="text-xs text-muted-foreground">
                Аккаунт Viber готов к работе на {emulator.name}.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface QrAuthPanelProps {
  phoneNumber: string
  onPhoneNumberChange: (value: string) => void
  clearData: boolean
  onClearDataChange: (value: boolean) => void
  loading: boolean
  status: QrAuthStatus | null
  onSubmit: (e: React.FormEvent) => void
  onCancelSession: () => void | Promise<void>
  onClose: () => void | Promise<void>
  onOpenScreen?: () => void
}

/**
 * Вход вторым устройством: номер аккаунта → QR-код → сканирование с телефона.
 *
 * SMS при этом не отправляется — номер нужен только чтобы Viber нашёл
 * существующий аккаунт и показал код для подтверждения с основного устройства.
 */
function QrAuthPanel({
  phoneNumber,
  onPhoneNumberChange,
  clearData,
  onClearDataChange,
  loading,
  status,
  onSubmit,
  onCancelSession,
  onClose,
  onOpenScreen,
}: QrAuthPanelProps) {
  const described = status ? describeQrStatus(status) : null
  const image = qrImageSource(status?.qr)
  const live = status !== null && isQrSessionLive(status.state)

  if (status === null || status.state === "idle") {
    return (
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="qrPhone">Номер телефона аккаунта Viber</Label>
          <Input
            id="qrPhone"
            placeholder="+48794034881"
            value={phoneNumber}
            onChange={(e) => onPhoneNumberChange(e.target.value)}
            disabled={loading}
            autoFocus
            className="font-mono text-base tracking-wide"
          />
          <p className="text-xs text-muted-foreground">
            SMS не отправляется. По номеру Viber найдёт существующий аккаунт и покажет QR-код —
            отсканируйте его камерой Viber на основном телефоне.
          </p>
        </div>

        <div className="flex items-start space-x-2 pt-1">
          <Checkbox
            id="qrClearData"
            checked={clearData}
            onCheckedChange={(checked) => onClearDataChange(checked === true)}
            disabled={loading}
          />
          <label
            htmlFor="qrClearData"
            className="text-xs font-medium leading-none cursor-pointer pt-0.5"
          >
            Сбросить данные Viber перед входом (чистая сессия)
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button type="button" variant="outline" onClick={() => void onClose()} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Открываем...
              </>
            ) : (
              "Показать QR"
            )}
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex justify-center">
        {image === null ? (
          <div
            className="flex h-[320px] w-[320px] items-center justify-center rounded-xl border border-dashed bg-muted/40"
            data-testid="qr-placeholder"
          >
            <Loader2Icon className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="rounded-xl bg-white p-4 shadow-sm" data-testid="qr-frame">
            {image.kind === "svg" ? (
              <div
                data-testid="qr-svg"
                className="h-[320px] w-[320px] [&>svg]:h-full [&>svg]:w-full"
                // Сервер отдаёт SVG, который сам же и нарисовал из распознанного
                // кода — это наша разметка, а не пользовательский ввод.
                dangerouslySetInnerHTML={{ __html: image.markup }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                data-testid="qr-png"
                src={image.src}
                alt="QR-код для входа в Viber"
                width={320}
                height={320}
                className="h-[320px] w-[320px]"
                // Картинка снята с экрана 540px — без этого браузер размывает
                // её при увеличении, и камера перестаёт читать код.
                style={{ imageRendering: "pixelated" }}
              />
            )}
          </div>
        )}
      </div>

      {described && (
        <div
          role="status"
          className={`flex items-center justify-center gap-2 text-sm font-medium ${
            TONE_CLASSES[described.tone] ?? TONE_CLASSES.neutral
          }`}
        >
          {described.busy && <Loader2Icon className="h-4 w-4 animate-spin" />}
          {status.state === "unknown_screen" && <AlertTriangleIcon className="h-4 w-4" />}
          {status.state === "ready" && <CheckCircle2Icon className="h-4 w-4" />}
          <span>{described.label}</span>
        </div>
      )}

      {status.state === "qr_ready" && (
        <p className="text-center text-xs text-muted-foreground">
          Viber на телефоне → «Ещё» → «Компьютеры и планшеты» → сканировать код
        </p>
      )}

      {status.state === "unknown_screen" && status.screenshotBase64 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Что сейчас на экране эмулятора:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-testid="qr-unknown-screenshot"
            src={`data:image/png;base64,${status.screenshotBase64}`}
            alt="Экран эмулятора"
            className="mx-auto max-h-[320px] rounded-lg border"
          />
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-xs">
        {onOpenScreen && (
          <button
            type="button"
            onClick={onOpenScreen}
            className="flex items-center gap-1 text-muted-foreground underline hover:text-foreground"
          >
            <SmartphoneIcon className="h-3 w-3" />
            Открыть экран устройства
          </button>
        )}
        {!live && status.state !== "ready" && (
          <button
            type="button"
            onClick={() => void onCancelSession()}
            className="flex items-center gap-1 text-purple-600 hover:underline"
          >
            <RotateCcwIcon className="h-3 w-3" />
            Начать заново
          </button>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0 pt-2">
        <Button type="button" variant="outline" onClick={() => void onClose()}>
          {live ? "Отменить" : "Закрыть"}
        </Button>
      </DialogFooter>
    </div>
  )
}
