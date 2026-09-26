import * as React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TypeScale } from "@/components/design-system/type-scale"
import { formatNumber } from "@/lib/format"

describe("TypeScale", () => {
  it("образец Mono показывает число через formatNumber, а не с обычным пробелом", () => {
    const { container } = render(<TypeScale />)

    expect(container.textContent).toContain(`14:32:08 · ${formatNumber(128450)}`)
    expect(container.textContent).not.toContain("128 450")
  })
})
