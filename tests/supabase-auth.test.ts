import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

describe('Supabase Auth & Middleware', () => {
  it('redirects unauthenticated user accessing /dashboard to /login', async () => {
    const req = new NextRequest('http://localhost:3000/dashboard/viber')
    const res = await updateSession(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('next=%2Fdashboard%2Fviber')
  })

  it('allows access to public pages without redirect', async () => {
    const req = new NextRequest('http://localhost:3000/design-system')
    const res = await updateSession(req)

    expect(res.status).toBe(200)
  })

  it('allows access to /login when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/login')
    const res = await updateSession(req)

    expect(res.status).toBe(200)
  })
})
