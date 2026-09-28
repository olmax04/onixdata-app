import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token?: string) => ({
        data: { user: token === "valid-token" ? { id: "user-1" } : null },
      })),
    },
  })),
}))

import { updateSession } from "../lib/supabase/middleware"

describe("/api/emulators auth", () => {
  it("rejects an anonymous request", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/api/emulators/worker-1/viber/logout")
    )

    expect(response.status).toBe(401)
  })

  it("allows an authenticated Supabase user", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/api/emulators", {
        headers: { Authorization: "Bearer valid-token" },
      })
    )

    expect(response.status).toBe(200)
  })
})
