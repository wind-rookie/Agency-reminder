import { BrowserWindow, ipcMain, screen } from 'electron'
import { pathToFileURL } from 'url'
import type { IpcMainInvokeEvent, Rectangle } from 'electron'
import type { NotificationPosition } from './reminder-scheduler'
import { createInitialVelocity, stepBall, type BallState, type BallBounds } from './bounce-physics'

export interface NotificationWindowResult {
  success: boolean
  error?: string
}

interface NotificationWindowOptions {
  isDev: boolean
  preloadPath: string
  developmentUrl: string
  productionIndexPath: string
  getReferenceBounds: () => Rectangle | null
  logError: (message: string) => void
}

export interface NotificationPayload {
  title: string
  body: string
  position?: NotificationPosition
  persistent?: boolean
  todoId?: string
  moveEnabled?: boolean
  moveDelay?: number
}

interface NotificationIpcDependencies {
  assertMainWindowSender: (event: IpcMainInvokeEvent) => void
  showNotificationWindow: (payload: NotificationPayload) => Promise<NotificationWindowResult>
}

export interface NotificationWindowController {
  showNotificationWindow: (payload: NotificationPayload) => Promise<NotificationWindowResult>
  closePersistentWindow: (todoId: string) => void
  closeAllPersistentWindows: () => void
}

const MOVE_FRAME_MS = 16

export function createNotificationWindow(options: NotificationWindowOptions): NotificationWindowController {
  // 持久弹窗登记表：todoId -> BrowserWindow（用于去重 + 完成/删除时关闭）
  const persistentWindows = new Map<string, BrowserWindow>()
  // 悬停暂停回调：webContents.id -> (hovering) => void
  const hoverCallbacks = new Map<number, (hovering: boolean) => void>()

  ipcMain.on('notification-hover', (event, hovering: unknown) => {
    const callback = hoverCallbacks.get(event.sender.id)
    if (callback) callback(hovering === true)
  })

  async function showNotificationWindow(payload: NotificationPayload): Promise<NotificationWindowResult> {
    let notificationWindow: BrowserWindow | null = null
    let autoCloseTimer: ReturnType<typeof setTimeout> | null = null
    let moveDelayTimer: ReturnType<typeof setTimeout> | null = null
    let moveInterval: ReturnType<typeof setInterval> | null = null
    let ballState: BallState | null = null
    let ballBounds: BallBounds | null = null
    let movePaused = false

    function stopMovement() {
      if (moveDelayTimer) clearTimeout(moveDelayTimer)
      if (moveInterval) clearInterval(moveInterval)
      moveDelayTimer = null
      moveInterval = null
    }

    try {
      const {
        title,
        body,
        position = 'bottom-right',
        persistent = false,
        todoId,
        moveEnabled = false,
        moveDelay = 30
      } = payload

      // 去重：同一 todoId 的持久弹窗已活跃时不再重复弹出
      if (persistent && todoId && persistentWindows.has(todoId)) {
        return { success: true }
      }

      const referenceBounds = options.getReferenceBounds()
      const display = referenceBounds ? screen.getDisplayMatching(referenceBounds) : screen.getPrimaryDisplay()
      const { x: areaX, y: areaY, width: screenWidth, height: screenHeight } = display.workArea
      const notifWidth = 320
      const notifHeight = 80
      const padding = 20
      let x: number
      let y: number

      switch (position) {
        case 'top-left':
          x = areaX + padding
          y = areaY + padding
          break
        case 'top-right':
          x = areaX + screenWidth - notifWidth - padding
          y = areaY + padding
          break
        case 'bottom-left':
          x = areaX + padding
          y = areaY + screenHeight - notifHeight - padding
          break
        case 'bottom-right':
        default:
          x = areaX + screenWidth - notifWidth - padding
          y = areaY + screenHeight - notifHeight - padding
          break
      }

      notificationWindow = new BrowserWindow({
        width: notifWidth,
        height: notifHeight,
        x,
        y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
          preload: options.preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          additionalArguments: ['--notification-window']
        }
      })

      const webContentsId = notificationWindow.webContents.id
      const expectedProductionUrl = pathToFileURL(options.productionIndexPath).toString()
      notificationWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      notificationWindow.webContents.on('console-message', details => {
        if (details.level === 'warning' || details.level === 'error') {
          options.logError(
            `[通知窗口渲染器:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`
          )
        }
      })
      notificationWindow.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (isMainFrame) {
            options.logError(`[通知窗口加载失败] ${errorCode} ${errorDescription} ${validatedURL}`)
          }
        }
      )
      notificationWindow.webContents.on('will-navigate', (event, targetUrl) => {
        let allowed = false
        try {
          if (options.isDev) {
            allowed = new URL(targetUrl).origin === new URL(options.developmentUrl).origin
          } else {
            const normalizedTarget = new URL(targetUrl)
            normalizedTarget.hash = ''
            normalizedTarget.search = ''
            allowed = normalizedTarget.toString() === expectedProductionUrl
          }
        } catch {
          allowed = false
        }
        if (!allowed) event.preventDefault()
      })

      if (options.isDev) {
        await notificationWindow.loadURL(options.developmentUrl)
      } else {
        await notificationWindow.loadFile(options.productionIndexPath, { hash: '/notification' })
      }

      notificationWindow.webContents.send('notification-data', { title, body, persistent })

      if (persistent) {
        if (todoId) persistentWindows.set(todoId, notificationWindow)

        if (moveEnabled) {
          const current = notificationWindow.getPosition()
          const initial = createInitialVelocity()
          ballBounds = {
            minX: areaX,
            minY: areaY,
            maxX: areaX + screenWidth - notifWidth,
            maxY: areaY + screenHeight - notifHeight
          }
          ballState = {
            x: current[0],
            y: current[1],
            vx: initial.vx,
            vy: initial.vy
          }

          const safeDelay = Math.min(600, Math.max(5, moveDelay)) * 1000
          moveDelayTimer = setTimeout(() => {
            if (!notificationWindow || notificationWindow.isDestroyed()) return
            let lastTime = Date.now()
            moveInterval = setInterval(() => {
              if (!notificationWindow || notificationWindow.isDestroyed()) {
                stopMovement()
                return
              }
              if (movePaused) return
              const now = Date.now()
              const dt = Math.min((now - lastTime) / 1000, 0.1)
              lastTime = now
              if (!ballState || !ballBounds) return
              ballState = stepBall(ballState, ballBounds, dt)
              notificationWindow.setPosition(Math.round(ballState.x), Math.round(ballState.y))
            }, MOVE_FRAME_MS)
          }, safeDelay)
        }
      } else {
        autoCloseTimer = setTimeout(() => {
          if (notificationWindow && !notificationWindow.isDestroyed()) {
            notificationWindow.close()
          }
        }, 5000)
      }

      hoverCallbacks.set(webContentsId, hovering => {
        movePaused = hovering
      })

      notificationWindow.on('closed', () => {
        if (autoCloseTimer) clearTimeout(autoCloseTimer)
        hoverCallbacks.delete(webContentsId)
        stopMovement()
        if (persistent && todoId) persistentWindows.delete(todoId)
      })
      return { success: true }
    } catch (error) {
      stopMovement()
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
      if (notificationWindow && !notificationWindow.isDestroyed()) {
        notificationWindow.destroy()
      }
      const message = `显示通知失败：${error instanceof Error ? error.message : String(error)}`
      options.logError(message)
      return { success: false, error: message }
    }
  }

  function closePersistentWindow(todoId: string) {
    const win = persistentWindows.get(todoId)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    persistentWindows.delete(todoId)
  }

  function closeAllPersistentWindows() {
    for (const win of persistentWindows.values()) {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
    persistentWindows.clear()
  }

  return { showNotificationWindow, closePersistentWindow, closeAllPersistentWindows }
}

export function registerNotificationIpcHandler(dependencies: NotificationIpcDependencies) {
  ipcMain.handle('show-notification', async (event, options: unknown) => {
    dependencies.assertMainWindowSender(event)
    if (!options || typeof options !== 'object') {
      return { success: false, error: '通知参数无效' }
    }

    const payload = options as Partial<NotificationPayload>
    if (typeof payload.title !== 'string' || typeof payload.body !== 'string') {
      return { success: false, error: '通知参数无效' }
    }
    return dependencies.showNotificationWindow(payload as NotificationPayload)
  })
}
