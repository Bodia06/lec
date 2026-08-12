import { CONFIG } from '../config/constants.js'

let executionLogs = []

export function sendLog (text) {
  const timestamp = new Date().toLocaleTimeString()
  const formatted = `[${timestamp}] ${text}`
  executionLogs.push(formatted)

  if (executionLogs.length > CONFIG.LOG_MAX_HISTORY) {
    executionLogs.shift()
  }

  const styles = {
    '[SUCCESS]': 'color: #00ff66; font-weight: bold;',
    '[ERROR]': 'color: #ff5252; font-weight: bold;',
    '[WARN]': 'color: #ffab40; font-weight: bold;'
  }

  const matchedKey = Object.keys(styles).find(key => text.includes(key))
  console.log(`%c${formatted}`, styles[matchedKey] || 'color: #40c4ff;')

  chrome.runtime.sendMessage({ action: 'LOG', text: formatted }).catch(() => {})
}

export function getExecutionLogs () {
  return executionLogs
}

export function clearExecutionLogs () {
  executionLogs = []
}
