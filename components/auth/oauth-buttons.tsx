"use client"

import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { authPress } from "@/components/auth/auth-motion"
import { Button } from "@/components/ui/button"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="currentColor"
        d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.55v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.79 1.06.79 2.14v3.17c0 .3.21.67.8.55A11.5 11.5 0 0 0 12 .5z"
      />
    </svg>
  )
}

export function OAuthButtons({ className }: { className?: string }) {
  const handleOAuth = async (provider: "google" | "github") => {
    const isConfigured = isSupabaseConfigured()

    if (!isConfigured) {
      toast("Демо: OAuth не подключён", {
        description: `Вход через ${provider} (Supabase не настроен в .env.local).`,
      })
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(`Ошибка авторизации через ${provider}`, {
          description: error.message,
        })
      }
    } catch (err) {
      toast.error("Ошибка OAuth", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 bg-transparent hover:bg-accent", authPress)}
        onClick={() => handleOAuth("google")}
      >
        <GoogleIcon />
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 bg-transparent hover:bg-accent", authPress)}
        onClick={() => handleOAuth("github")}
      >
        <GitHubIcon />
        GitHub
      </Button>
    </div>
  )
}
