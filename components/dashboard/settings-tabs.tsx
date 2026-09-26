"use client"

import * as React from "react"
import { CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { currentUser, demoApiKey } from "@/lib/mock-data"

function ProfileTab() {
  const [name, setName] = React.useState(currentUser.name)
  const [email, setEmail] = React.useState(currentUser.email)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
        <CardDescription>
          Как вас видят участники рабочей области. Демо-режим: изменения не
          сохраняются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Имя</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() =>
            toast.success("Профиль сохранён", {
              description: "Демо-режим: данные не отправляются на сервер.",
            })
          }
        >
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  )
}

function ApiTab() {
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(demoApiKey)
      toast.success("Ключ скопирован", {
        description: "Это демонстрационный ключ, он ничего не открывает.",
      })
    } catch {
      toast.error("Не удалось скопировать", {
        description: "Скопируйте ключ вручную.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API</CardTitle>
        <CardDescription>
          Ключ для доступа к выгрузкам. Значение ниже — демонстрационное.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-api-key">Ключ доступа</Label>
          <div className="flex max-w-xl gap-2">
            <Input
              id="settings-api-key"
              readOnly
              value={demoApiKey}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              onClick={copyKey}
              aria-label="Скопировать API-ключ"
            >
              <CopyIcon />
              Скопировать
            </Button>
          </div>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Ключ даёт доступ только к публичным данным, собранным вашими
          источниками.
        </p>
      </CardContent>
    </Card>
  )
}

function NotificationsTab() {
  const [sourceAlerts, setSourceAlerts] = React.useState(true)
  const [weeklyDigest, setWeeklyDigest] = React.useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Уведомления</CardTitle>
        <CardDescription>
          Что присылать по почте. Демо-режим: письма не отправляются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-sources">Сбои источников</Label>
            <p className="text-sm text-muted-foreground">
              Письмо, если источник перестал отдавать данные.
            </p>
          </div>
          <Switch
            id="notify-sources"
            checked={sourceAlerts}
            onCheckedChange={setSourceAlerts}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-digest">Еженедельный дайджест</Label>
            <p className="text-sm text-muted-foreground">
              Сводка по упоминаниям и тональности за неделю.
            </p>
          </div>
          <Switch
            id="notify-digest"
            checked={weeklyDigest}
            onCheckedChange={setWeeklyDigest}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsTabs() {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Профиль</TabsTrigger>
        <TabsTrigger value="api">API</TabsTrigger>
        <TabsTrigger value="notifications">Уведомления</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab />
      </TabsContent>
      <TabsContent value="api">
        <ApiTab />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
    </Tabs>
  )
}
