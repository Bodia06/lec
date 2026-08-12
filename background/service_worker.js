import { StorageService } from './services/storageService.js'
import { sendLog } from './services/logger.js'
import { runAutomation } from './automation/runner.js'
import { messageHandlers } from './handlers/messageHandlers.js'

StorageService.get(['botState', 'activeTabId']).then(data => {
  if (data.botState === 'RUNNING' && data.activeTabId) {
    sendLog('[INFO] Restoring automation run after Service Worker restart...')
    runAutomation(data.activeTabId)
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action]
  if (handler) {
    handler(message, sendResponse)
  }
  return true
})
