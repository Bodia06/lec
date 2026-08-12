import { StorageManager } from '../utils/storageManager.js'

export async function checkRateLimitsMiddleware (accountId = 'default_account') {
  const stats = await StorageManager.getStats(accountId)
  const limits = await chrome.storage.local.get({
    maxDaily: 10,
    maxWeekly: 100
  })

  if (
    stats.dailyCount >= limits.maxDaily ||
    stats.weeklyCount >= limits.maxWeekly
  ) {
    return {
      allowed: false,
      reason: `Daily limit (${limits.maxDaily}) or weekly limit reached for [${accountId}].`
    }
  }

  return { allowed: true }
}
