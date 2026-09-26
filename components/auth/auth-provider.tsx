"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { resolveProfileName } from "@/lib/settings/profile-form"

export interface UserProfile {
  name: string
  email: string
  initials: string
  avatarUrl?: string | null
  role?: string
}

interface ProfileRow {
  full_name: string | null
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  refresh: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [profileRow, setProfileRow] = React.useState<ProfileRow | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const loadedForRef = React.useRef<string | undefined>(undefined)
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])

  const extractProfile = React.useCallback(
    (u: User | null, row: ProfileRow | null): UserProfile | null => {
      if (!u) return null
      const name = resolveProfileName({
        profileFullName: row?.full_name,
        metadataFullName: u.user_metadata?.['full_name'] as string | undefined,
        metadataName: u.user_metadata?.['name'] as string | undefined,
        email: u.email,
      })

      const email = u.email || ""
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || name.slice(0, 2).toUpperCase()

      return {
        name,
        email,
        initials,
        avatarUrl:
          row?.avatar_url ||
          (u.user_metadata?.['avatar_url'] as string) ||
          null,
        role: (u.user_metadata?.['role'] as string) || "Администратор",
      }
    },
    []
  )

  React.useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (mounted) {
          setUser(currentUser)
          setIsLoading(false)
        }
      } catch {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const userId = user?.id

  const loadProfile = React.useCallback(
    async (id: string | undefined) => {
      // При смене пользователя строку сбрасываем сразу: иначе до ответа select
      // виден email нового вперемешку с именем и аватаром предыдущего.
      if (loadedForRef.current !== id) {
        setProfileRow(null)
      }
      loadedForRef.current = id

      if (!id || !isSupabaseConfigured()) return null

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", id)
        .maybeSingle()

      const row = (data as ProfileRow | null) ?? null

      // Пользователь мог смениться, пока запрос был в пути.
      if (loadedForRef.current === id) {
        setProfileRow(row)
      }

      return row
    },
    [supabase]
  )

  React.useEffect(() => {
    void loadProfile(userId)
  }, [loadProfile, userId])

  const refresh = React.useCallback(async () => {
    if (!isSupabaseConfigured()) return

    let nextUserId = userId

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)
      nextUserId = currentUser?.id
    } catch {
      // сеть недоступна — оставляем текущего пользователя
    }

    // Ждём строку профиля до возврата: вызывающая форма полагается на то,
    // что после refresh() контекст уже содержит новое имя.
    await loadProfile(nextUserId)
  }, [supabase, userId, loadProfile])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfileRow(null)
    router.push("/login")
    router.refresh()
  }, [supabase, router])

  const profile = React.useMemo(
    () => extractProfile(user, profileRow),
    [user, profileRow, extractProfile]
  )

  return (
    <AuthContext.Provider
      value={{ user, profile, isLoading, refresh, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return React.useContext(AuthContext)
}
