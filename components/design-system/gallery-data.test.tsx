import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GalleryData } from "@/components/design-system/gallery-data"
import { formatNumber } from "@/lib/format"
import { sources, streamMessages } from "@/lib/mock-data"

describe("GalleryData", () => {
  it("в строке потока показывает число сообщений её источника, а не соседнего по индексу", () => {
    render(<GalleryData />)

    for (const message of streamMessages.slice(0, 4)) {
      const source = sources.find((item) => item.handle === message.source)
      expect(source).toBeDefined()

      const row = screen.getByText(message.source).closest("tr")
      expect(row).not.toBeNull()
      // formatNumber разделяет разряды неразрывным пробелом, а строковый матчер RTL
      // сравнивает с нормализованным текстом узла: без collapseWhitespace: false
      // U+00A0 схлопнется в обычный пробел и совпадения не будет никогда.
      expect(
        within(row!).getByText(formatNumber(source!.messages), { collapseWhitespace: false })
      ).toBeInTheDocument()
    }
  })
})
