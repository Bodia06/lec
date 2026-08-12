import { CDPInput } from '../utils/cpd.js'
import { StorageManager } from '../utils/storageManager.js'
import { checkLanguageMiddleware } from '../middlewares/languageMiddleware.js'
import { checkRateLimitsMiddleware } from '../middlewares/rateLimitsMiddleware.js'
import { StorageService } from '../services/storageService.js'
import { sendLog } from '../services/logger.js'
import { extractAccountInfoFromDOM } from './domScraper.js'
import { CONFIG } from '../config/constants.js'

let isRunning = false

export function getIsRunning () {
  return isRunning
}

export async function stopAutomation (reason = '[INFO] Automation stopped.') {
  isRunning = false
  await StorageService.setBotState('IDLE', null)
  sendLog(reason)
  chrome.runtime.sendMessage({ action: 'STOPPED' }).catch(() => {})
}

async function interruptibleSleep (ms, tabId) {
  let elapsed = 0
  while (elapsed < ms) {
    if (!isRunning) return false
    const { botState } = await StorageService.getBotState()
    if (botState !== 'RUNNING') {
      isRunning = false
      return false
    }
    await new Promise(r => setTimeout(r, CONFIG.INTERRUPT_INTERVAL))
    elapsed += CONFIG.INTERRUPT_INTERVAL
  }
  return isRunning
}

function getGaussianDelay (
  minMs = CONFIG.GAUSSIAN_MIN,
  maxMs = CONFIG.GAUSSIAN_MAX
) {
  const u = 1 - Math.random()
  const v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  const mean = (minMs + maxMs) / 2
  const stdDev = (minMs - minMs) / 6
  return Math.max(minMs, Math.min(maxMs, mean + z * stdDev))
}

async function recalculateDynamicLimits (tabId, currentAccountId, hasAdOffer) {
  const isWarmedUpOrPaid = !hasAdOffer
  const minLimit = isWarmedUpOrPaid ? 20 : 5
  const maxLimit = isWarmedUpOrPaid ? 30 : 10

  const dynamicMaxDaily =
    Math.floor(Math.random() * (maxLimit - minLimit + 1)) + minLimit
  const maxWeekly = CONFIG.DEFAULT_MAX_WEEKLY

  await StorageService.set({
    maxDaily: dynamicMaxDaily,
    maxWeekly,
    isWarmedUp: isWarmedUpOrPaid
  })

  sendLog(
    `[INFO] Recalculated new limit for [${currentAccountId}] (${
      isWarmedUpOrPaid ? 'warmed up / premium' : 'new / basic'
    }): daily limit = ${dynamicMaxDaily}, weekly = ${maxWeekly}`
  )
  return { maxDaily: dynamicMaxDaily, maxWeekly }
}

async function initializeAutomationAccount (tabId) {
  sendLog(
    '[INFO] Gathering complete account and subscription info before starting...'
  )

  const infoRes = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractAccountInfoFromDOM
  })

  const res = infoRes?.[0]?.result
  if (!res || !res.accountId || !res.name) {
    throw new Error('Failed to retrieve account data from DOM.')
  }

  const currentAccountId = res.accountId
  const currentAccountName = res.name
  const hasAdOffer = res.hasPremiumOffer || false

  const existingStorage = await StorageService.get(['maxDaily'])
  let dynamicLimit = existingStorage.maxDaily

  if (!dynamicLimit) {
    const limitsRes = await recalculateDynamicLimits(
      tabId,
      currentAccountId,
      hasAdOffer
    )
    dynamicLimit = limitsRes.maxDaily
  }

  await StorageService.set({
    cachedAccountId: currentAccountId,
    cachedAccountName: currentAccountName,
    maxDaily: dynamicLimit,
    currentAccountId
  })

  const allStatsData = (await StorageService.get(['stats_users'])) || {}
  const statsUsers = allStatsData.stats_users || {}
  if (!statsUsers[currentAccountId]) {
    statsUsers[currentAccountId] = { name: currentAccountName }
    await StorageService.set({ stats_users: statsUsers })
  }

  const stats = await StorageManager.getStats(currentAccountId)
  sendLog(
    `[INFO] Account fully verified: ${currentAccountName} (${currentAccountId}). Sent today: ${stats.dailyCount}. Daily limit: ${dynamicLimit}`
  )

  return { currentAccountId, dynamicLimit }
}

async function handleSearchPagination (tabId) {
  sendLog(
    '[INFO] No more targets on this page. Searching for the next page button...'
  )

  let pageRes
  try {
    pageRes = await chrome.tabs.sendMessage(tabId, { action: 'GO_NEXT_PAGE' })
  } catch (e) {
    pageRes = { success: false, reason: 'ERROR' }
  }

  if (!pageRes?.success) {
    sendLog(
      '[INFO] All search pages successfully completed! The "Next page" button is no longer available.'
    )
    await stopAutomation(
      '[INFO] Automation finished: reached the end of search results.'
    )
    return false
  }

  sendLog(
    '[INFO] Page successfully changed. Waiting for new results to load...'
  )
  if (!(await interruptibleSleep(CONFIG.PAGE_LOAD_SLEEP, tabId))) return false

  try {
    await CDPInput.sendCommand(tabId, 'Runtime.evaluate', { expression: '1+1' })
  } catch (e) {
    try {
      await CDPInput.attach(tabId)
    } catch (err) {}
  }

  return true
}

async function processTargetNode (tabId, targetRes, activeAcc) {
  const { x, y } = targetRes.coords

  if (!isRunning) return false
  await CDPInput.trustedClick(tabId, x, y)
  if (!(await interruptibleSleep(1200, tabId))) return false

  let modalRes
  try {
    modalRes = await chrome.tabs.sendMessage(tabId, { action: 'HANDLE_MODAL' })
  } catch (e) {
    modalRes = { status: 'UNKNOWN_MODAL' }
  }

  if (!isRunning) return false

  if (modalRes?.status === 'LIMIT_STOP') {
    sendLog('[WARN] LinkedIn invitation limit detected! Immediate stop.')
    return false
  }

  let actionSuccessful = false

  if (modalRes?.status === 'CLICK_SEND') {
    if (!isRunning) return false
    await CDPInput.trustedClick(tabId, modalRes.coords.x, modalRes.coords.y)
    actionSuccessful = true
  } else if (modalRes?.status === 'SUCCESS_DIRECT') {
    actionSuccessful = true
  } else if (modalRes?.status === 'SKIPPED_EMAIL_REQUIRED') {
    sendLog('[INFO] Skipped profile (requires email verification).')
  } else if (modalRes?.status === 'UNKNOWN_MODAL') {
    sendLog('[WARN] Unknown modal encountered — closed for safety.')
  }

  if (actionSuccessful) {
    if (!(await interruptibleSleep(CONFIG.POST_ACTION_SLEEP, tabId)))
      return false

    let verifyRes
    try {
      verifyRes = await chrome.tabs.sendMessage(tabId, {
        action: 'VERIFY_TARGET_PENDING'
      })
    } catch (e) {
      verifyRes = { success: false }
    }

    if (!isRunning) return false

    if (!verifyRes?.success) {
      sendLog(
        '[ERROR] User button did not change to Pending! Possible limit or interface error. Stopping program.'
      )
      await stopAutomation(
        '[ERROR] Stopped due to Pending status verification failure.'
      )
      return false
    }

    await StorageManager.incrementStats(activeAcc)
    const updatedStats = await StorageManager.getStats(activeAcc)
    const storageData = await StorageService.get(['maxDaily', 'isWarmedUp'])
    const currentMaxDaily = storageData.maxDaily || CONFIG.DEFAULT_MAX_DAILY

    const logType =
      modalRes?.status === 'CLICK_SEND'
        ? 'Invitation sent'
        : 'Direct invite sent'
    sendLog(
      `[SUCCESS] ${logType} #${updatedStats.dailyCount} for [${activeAcc}]`
    )

    if (updatedStats.dailyCount >= currentMaxDaily) {
      sendLog(
        `[INFO] Daily limit reached (${updatedStats.dailyCount}/${currentMaxDaily}). Recalculating limit for the next day and stopping...`
      )
      await recalculateDynamicLimits(tabId, activeAcc, !storageData.isWarmedUp)
      await stopAutomation(
        '[INFO] Automation stopped: daily limit fully exhausted.'
      )
      return false
    }
  }

  const delay = getGaussianDelay()
  return interruptibleSleep(delay, tabId)
}

export async function runAutomation (tabId) {
  if (isRunning) return

  sendLog('[INFO] Checking LinkedIn interface language...')
  const isEnglish = await checkLanguageMiddleware(tabId)

  if (!isEnglish) {
    sendLog(
      '[ERROR] LinkedIn interface language is not English! Startup blocked. Please switch your account language to English in settings.'
    )
    await stopAutomation('[ERROR] Run aborted due to unsupported language.')
    return
  }

  let activeAcc = ''
  try {
    const initData = await initializeAutomationAccount(tabId)
    activeAcc = initData.currentAccountId
  } catch (err) {
    sendLog(
      `[ERROR] Initialization failed: ${err.message || err}. Startup aborted.`
    )
    await stopAutomation('[ERROR] Run aborted due to missing account data.')
    return
  }

  await new Promise(r => setTimeout(r, CONFIG.STARTUP_SLEEP))

  isRunning = true
  await StorageService.setBotState('RUNNING', tabId, activeAcc)
  sendLog('[INFO] Automation started.')

  try {
    try {
      await CDPInput.attach(tabId)
    } catch (e) {}

    while (isRunning) {
      const stateData = await StorageService.getBotState()
      if (stateData.botState !== 'RUNNING') {
        isRunning = false
        break
      }

      activeAcc = stateData.currentAccountId
      const limitCheck = await checkRateLimitsMiddleware(activeAcc)
      if (!limitCheck.allowed) {
        sendLog(`[INFO] ${limitCheck.reason} Stopping automation.`)
        break
      }

      let targetRes
      try {
        targetRes = await chrome.tabs.sendMessage(tabId, {
          action: 'GET_NEXT_TARGET'
        })
      } catch (e) {
        targetRes = { status: 'NO_MORE_TARGETS' }
      }

      if (!isRunning) break

      if (!targetRes || targetRes.status === 'NO_MORE_TARGETS') {
        const shouldContinue = await handleSearchPagination(tabId)
        if (!shouldContinue) break
        continue
      }

      if (targetRes.status === 'TARGET_FOUND') {
        const success = await processTargetNode(tabId, targetRes, activeAcc)
        if (!success) break
      }
    }
  } catch (err) {
    console.error('Automation Error:', err)
    const errorMsg =
      typeof err === 'object' && err !== null
        ? err.message || JSON.stringify(err)
        : String(err)
    sendLog(`[ERROR] ${errorMsg}`)
  } finally {
    try {
      await CDPInput.detach(tabId)
    } catch (e) {}
    await stopAutomation('[INFO] Automation stopped.')
  }
}
