import { StorageService } from '../services/storageService.js'
import {
  sendLog,
  getExecutionLogs,
  clearExecutionLogs
} from '../services/logger.js'
import {
  runAutomation,
  stopAutomation,
  getIsRunning
} from '../automation/runner.js'
import { StorageManager } from '../utils/storageManager.js'
import { CONFIG } from '../config/constants.js'

export const messageHandlers = {
  START: async (message, sendResponse) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        func: () => {
          window.processedCardIds?.clear()
        }
      })
    } catch (e) {}

    runAutomation(message.tabId)
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
    try {
      const stored = await StorageService.get(['cachedAccountId', 'maxDaily'])
      const accountId = stored.cachedAccountId || 'default_account'
      const maxDaily = stored.maxDaily || CONFIG.DEFAULT_MAX_DAILY
      const stats = await StorageManager.getStats(accountId)

      sendResponse({
        accountId,
        maxDaily,
        count: 0,
        dailyCount: stats.dailyCount
      })
    } catch (e) {
      const stats = await StorageManager.getStats('default_account')
      sendResponse({
        accountId: 'default_account',
        maxDaily: CONFIG.DEFAULT_MAX_DAILY,
        count: 0,
        dailyCount: stats.dailyCount
      })
    }
  }
}
