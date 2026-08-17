import { StorageService } from '../services/storageService.js'
import { clearExecutionLogs, getExecutionLogs } from '../services/logger.js'
import {
  getIsRunning,
  runAutomation,
  stopAutomation
} from '../automation/runner.js'
import { StorageManager } from '../utils/storageManager.js'
import { CONFIG } from '../config/constants.js'

export const messageHandlers = {
  START: async (message, sendResponse) => {
    const mode = message.mode || 'CONNECT'
    try {
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        func: () => {
          window.processedCardIds?.clear()
          window.processedPostIds?.clear()
        }
      })
    } catch (e) {}

    runAutomation(message.tabId, mode)
    sendResponse({ status: 'STARTED' })
  },
  STOP: async (message, sendResponse) => {
    await stopAutomation('[INFO] Stop requested by user.')
    sendResponse({ status: 'STOPPED' })
  },
  GET_STATE: (message, sendResponse) => {
    sendResponse({ isRunning: getIsRunning(), logs: getExecutionLogs() })
  },
  CLEAR_LOGS: (message, sendResponse) => {
    clearExecutionLogs()
    chrome.runtime.sendMessage({ action: 'LOGS_CLEARED' }).catch(() => {})
    sendResponse({ status: 'CLEARED' })
  },
  GET_CURRENT_ACCOUNT: async (message, sendResponse) => {
    const mode = message.mode || 'CONNECT'
    try {
      const stored = await StorageService.get(['cachedAccountId', 'maxDaily'])
      const accountId = stored.cachedAccountId || 'default_account'
      const maxDaily =
        stored.maxDaily || (mode === 'LIKE' ? 30 : CONFIG.DEFAULT_MAX_DAILY)
      const stats = await StorageManager.getStats(accountId, mode)

      sendResponse({
        accountId,
        maxDaily,
        count: 0,
        dailyCount: stats.dailyCount
      })
    } catch (e) {
      const stats = await StorageManager.getStats('default_account', mode)
      sendResponse({
        accountId: 'default_account',
        maxDaily: CONFIG.DEFAULT_MAX_DAILY,
        count: 0,
        dailyCount: stats.dailyCount
      })
    }
  }
}
