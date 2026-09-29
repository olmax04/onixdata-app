"use strict"

/**
 * Точка входа контейнера: стандартный `server.js` из `output: "standalone"`
 * плюс перехват WebSocket-апгрейдов `/scrcpy/*` (см. scrcpy-upgrade.cjs).
 */

const http = require("node:http")
const path = require("node:path")

const { createScrcpyUpgradeHandler, installScrcpyUpgradeHook } = require("./scrcpy-upgrade.cjs")

const port = parseInt(process.env.PORT, 10) || 3000
const sessionOrigin = process.env.SCRCPY_SESSION_ORIGIN?.trim() || `http://127.0.0.1:${port}`

installScrcpyUpgradeHook(http, createScrcpyUpgradeHandler({ sessionOrigin }))

require(path.join(__dirname, "..", "server.js"))
