import { StorageManager } from '../utils/storageManager.js'
import { CONFIG } from '../config/constants.js'

export async function checkRateLimitsMiddleware (
  accountId = 'default_account',
  mode = 'CONNECT'
) {
  const stats = await StorageManager.getStats(accountId, mode)
  const modeKey = mode.toLowerCase()

  const defaultDaily = mode === 'LIKE' ? 25 : CONFIG.DEFAULT_MAX_DAILY
  const defaultWeekly = mode === 'LIKE' ? 250 : CONFIG.DEFAULT_MAX_WEEKLY

  const limits = await chrome.storage.local.get({
    [`maxDaily_${modeKey}`]: defaultDaily,
    [`maxWeekly_${modeKey}`]: defaultWeekly
  })

  const maxDaily = limits[`maxDaily_${modeKey}`]
  const maxWeekly = limits[`maxWeekly_${modeKey}`]

  if (stats.dailyCount >= maxDaily || stats.weeklyCount >= maxWeekly) {
    return {
      allowed: false,
      reason: `[${mode}] Daily limit (${maxDaily}) or weekly limit (${maxWeekly}) reached for [${accountId}].`
    }
  }

  return { allowed: true }
}
