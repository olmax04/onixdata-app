import { describe, expect, it } from "vitest"

import {
  buildScrcpyStreamUrl,
  formatScrcpyStreamUrl,
  isLoopbackHost,
  panelScrcpyStreamUrl,
  resolveScrcpyUdid,
  scrcpyPublicOrigin,
  scrcpyUpstreamOrigin,
} from "../lib/scrcpy"

/** Рабочая ссылка с VPS, проверенная вручную. */
const WORKING_STREAM_URL =
  "http://136.92.24.88:8000/#!action=stream&udid=host.docker.internal%3A5557&player=broadway&ws=ws%3A%2F%2F136.92.24.88%3A8000%2F%3Faction%3Dproxy-adb%26remote%3Dtcp%253A8886%26udid%3Dhost.docker.internal%253A5557"

/** То, что сейчас отдаёт emulator-agent без HOST_PUBLIC_IP. */
const AGENT_LOCALHOST_URL =
  "http://localhost:8000/#!action=stream&udid=host.docker.internal%3A5557&player=mse&ws=ws%3A%2F%2Flocalhost%3A8000%2F"

describe("buildScrcpyStreamUrl", () => {
  it("строит ссылку в формате рабочей трансляции", () => {
    expect(buildScrcpyStreamUrl("http://136.92.24.88:8000/", "host.docker.internal:5557")).toBe(
      WORKING_STREAM_URL
    )
  })

  it("на HTTPS-прокси панели использует wss и тот же путь", () => {
    const url = new URL(
      buildScrcpyStreamUrl("https://panel.example.com/scrcpy/index.html", "host.docker.internal:5557")
    )
    expect(url.origin).toBe("https://panel.example.com")
    expect(url.pathname).toBe("/scrcpy/index.html")
    const hash = new URLSearchParams(url.hash.slice(2))
    expect(hash.get("player")).toBe("broadway")
    expect(hash.get("ws")).toBe(
      "wss://panel.example.com/scrcpy/index.html?action=proxy-adb&remote=tcp%3A8886&udid=host.docker.internal%3A5557"
    )
  })
})

describe("formatScrcpyStreamUrl", () => {
  it("меняет localhost от агента на публичный адрес и чинит ws/player", () => {
    expect(formatScrcpyStreamUrl(AGENT_LOCALHOST_URL, 5557, "http://136.92.24.88:8000")).toBe(
      WORKING_STREAM_URL
    )
  })

  it("сохраняет публичный хост агента", () => {
    expect(formatScrcpyStreamUrl("http://136.92.24.88:8000/", 5557, "http://10.0.0.1:8000")).toBe(
      WORKING_STREAM_URL
    )
  })

  it("без публичного адреса оставляет хост как есть", () => {
    expect(formatScrcpyStreamUrl("http://127.0.0.1:8000/", 5555)).toMatch(
      /^http:\/\/127\.0\.0\.1:8000\/#!action=stream/
    )
  })

  it("возвращает null для пустой или битой ссылки", () => {
    expect(formatScrcpyStreamUrl(null, 5555)).toBeNull()
    expect(formatScrcpyStreamUrl("not a url", 5555)).toBeNull()
  })
})

describe("resolveScrcpyUdid", () => {
  it("берёт udid из ссылки агента", () => {
    expect(resolveScrcpyUdid(AGENT_LOCALHOST_URL, 5599)).toBe("host.docker.internal:5557")
  })

  it("без udid в ссылке строит его по ADB-порту", () => {
    expect(resolveScrcpyUdid("http://host:8000/", 5561)).toBe("host.docker.internal:5561")
    expect(resolveScrcpyUdid("http://host:8000/", null)).toBe("host.docker.internal:5555")
  })
})

describe("panelScrcpyStreamUrl", () => {
  it("ведёт на /scrcpy/ панели, а не на VPS", () => {
    const url = panelScrcpyStreamUrl("https://panel.example.com/dashboard/emulators", AGENT_LOCALHOST_URL, 5557)
    expect(url).toBe(
      buildScrcpyStreamUrl("https://panel.example.com/scrcpy/index.html", "host.docker.internal:5557")
    )
  })

  it("без ссылки агента экран недоступен", () => {
    expect(panelScrcpyStreamUrl("https://panel.example.com", null, 5557)).toBeNull()
  })
})

describe("isLoopbackHost", () => {
  it.each(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "LOCALHOST"])("%s — loopback", (host) => {
    expect(isLoopbackHost(host)).toBe(true)
  })

  it("публичный адрес — не loopback", () => {
    expect(isLoopbackHost("136.92.24.88")).toBe(false)
  })
})

describe("scrcpyUpstreamOrigin", () => {
  it("предпочитает явный SCRCPY_URL", () => {
    expect(
      scrcpyUpstreamOrigin({ SCRCPY_URL: "https://screen.example.com/x", VIBER_PARSER_URL: "http://1.2.3.4:8080" })
    ).toBe("https://screen.example.com")
  })

  it("иначе берёт хост агента, затем Viber-parser, с портом 8000", () => {
    expect(
      scrcpyUpstreamOrigin({ EMULATOR_AGENT_URL: "http://5.6.7.8:9000", VIBER_PARSER_URL: "http://1.2.3.4:8080" })
    ).toBe("http://5.6.7.8:8000")
    expect(scrcpyUpstreamOrigin({ VIBER_PARSER_URL: "http://136.92.24.88:8080" })).toBe(
      "http://136.92.24.88:8000"
    )
  })

  it("без настроек возвращает null", () => {
    expect(scrcpyUpstreamOrigin({})).toBeNull()
    expect(scrcpyUpstreamOrigin({ SCRCPY_URL: "ftp://x" })).toBeNull()
  })
})

describe("scrcpyPublicOrigin", () => {
  it("в compose отделяет публичный адрес от внутреннего адреса прокси", () => {
    const env = {
      SCRCPY_URL: "http://host.docker.internal:8000",
      SCRCPY_PUBLIC_URL: "http://136.92.24.88:8000",
    }
    expect(scrcpyUpstreamOrigin(env)).toBe("http://host.docker.internal:8000")
    expect(scrcpyPublicOrigin(env)).toBe("http://136.92.24.88:8000")
  })

  it("без SCRCPY_PUBLIC_URL совпадает с адресом прокси", () => {
    expect(scrcpyPublicOrigin({ SCRCPY_URL: "http://136.92.24.88:8000" })).toBe(
      "http://136.92.24.88:8000"
    )
  })
})
