import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // Окружение по умолчанию — node; компонентные тесты помечены
    // директивой `@vitest-environment jsdom` в шапке файла.
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
})
