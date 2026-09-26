import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { ColorSwatches } from "@/components/design-system/color-swatches"
import { Elevation } from "@/components/design-system/elevation"
import { GalleryControls } from "@/components/design-system/gallery-controls"
import { GalleryData } from "@/components/design-system/gallery-data"
import { GalleryOverlays } from "@/components/design-system/gallery-overlays"
import { IconSet } from "@/components/design-system/icon-set"
import { LayoutSketches } from "@/components/design-system/layout-sketches"
import { MotionDemo } from "@/components/design-system/motion-demo"
import { Principles } from "@/components/design-system/principles"
import { RadiusScale } from "@/components/design-system/radius-scale"
import { DsSection } from "@/components/design-system/section"
import { SpacingScale } from "@/components/design-system/spacing-scale"
import { StatesTable } from "@/components/design-system/states"
import { Toc, TocInline } from "@/components/design-system/toc"
import { TypeScale } from "@/components/design-system/type-scale"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Дизайн-система",
  description:
    "Живой стайлгайд OnixData: токены, шкалы, паттерны и каталог компонентов интерфейса.",
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          {/* На узком экране вордмарк уступает место заголовку — иначе он обрезается. */}
          <BrandLogo markOnly className="sm:hidden" />
          <BrandLogo className="hidden sm:inline-flex" />
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
          <h1 className="truncate text-base font-semibold sm:text-lg">
            Дизайн-система
          </h1>

          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href="/dashboard">
              В дашборд
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-20">
            <Toc />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-12">
          <div className="space-y-4">
            <p className="max-w-3xl text-sm text-muted-foreground">
              Страница собрана из тех же компонентов и токенов, что и само
              приложение: всё, что видно ниже, — живое, а не картинка. Развёрнутое
              описание правил лежит в{" "}
              <span className="font-mono text-xs">docs/design-system.md</span>.
            </p>
            <TocInline />
          </div>

          <DsSection
            id="principles"
            title="Принципы"
            description="Восемь решений, из которых выведено всё остальное."
          >
            <Principles />
          </DsSection>

          <DsSection
            id="color"
            title="Цвет"
            description="Все цвета живут в CSS-переменных app/globals.css и попадают в разметку Tailwind-классами. HEX в компонентах не пишется — он есть только в lib/design-tokens.ts ради этой страницы и документации."
          >
            <ColorSwatches />
          </DsSection>

          <DsSection
            id="typography"
            title="Типографика"
            description="Один шрифт, четыре веса, десяток ролей. Размер выбирается по роли, а не по «на глаз крупнее»."
          >
            <TypeScale />
          </DsSection>

          <DsSection
            id="spacing"
            title="Spacing"
            description="Сетка 4px и небольшой набор повторяющихся связок классов."
          >
            <SpacingScale />
          </DsSection>

          <DsSection
            id="radius"
            title="Радиусы"
            description="Одна переменная --radius задаёт всю шкалу; крупные радиусы зарезервированы за брендовыми поверхностями."
          >
            <RadiusScale />
          </DsSection>

          <DsSection
            id="elevation"
            title="Поверхности"
            description="Слои, тени и липкие элементы каркаса."
          >
            <Elevation />
          </DsSection>

          <DsSection
            id="icons"
            title="Иконки"
            description="lucide-react, единый линейный стиль, четыре рабочих размера."
          >
            <IconSet />
          </DsSection>

          <DsSection
            id="motion"
            title="Motion"
            description="Движение объясняет появление контента и подтверждает нажатие. Всё остальное — тишина."
          >
            <MotionDemo />
          </DsSection>

          <DsSection
            id="layout"
            title="Layout"
            description="Две раскладки на всё приложение: auth и каркас дашборда."
          >
            <LayoutSketches />
          </DsSection>

          <DsSection
            id="states"
            title="Состояния"
            description="Как интерактивные элементы отвечают на наведение, фокус, нажатие, блокировку и ошибку."
          >
            <StatesTable />
          </DsSection>

          <DsSection
            id="components"
            title="Компоненты"
            description="Каталог: базовые элементы из components/ui и композиты, собранные под задачи OnixData."
          >
            <GalleryControls />
            <GalleryOverlays />
            <GalleryData />
          </DsSection>

          <footer className="border-t pt-6 text-xs text-muted-foreground">
            © 2026 OnixData. Демо-интерфейс · данные вымышленные
          </footer>
        </main>
      </div>
    </div>
  )
}
