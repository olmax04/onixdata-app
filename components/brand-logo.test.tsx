import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BrandLogo } from "@/components/brand-logo"

describe("BrandLogo", () => {
  it("с вордмарком не дублирует название для скринридера", () => {
    render(<BrandLogo />)

    expect(screen.queryByText("OnixData")).not.toBeInTheDocument()
    expect(screen.getByText("Onix")).toBeInTheDocument()
    expect(screen.getByText("Data")).toBeInTheDocument()
  })

  it("в режиме markOnly добавляет sr-only подпись", () => {
    render(<BrandLogo markOnly />)

    const label = screen.getByText("OnixData")
    expect(label).toHaveClass("sr-only")
    expect(screen.queryByText("Onix")).not.toBeInTheDocument()
  })
})
