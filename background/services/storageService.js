export const StorageService = {
  async get (keys) {
    return chrome.storage.local.get(keys)
  },
  async set (items) {
    return chrome.storage.local.set(items)
  },
  async getBotState () {
    const data = await this.get(['botState', 'activeTabId', 'currentAccountId'])
    return {
      botState: data.botState || 'IDLE',
      activeTabId: data.activeTabId || null,
      currentAccountId: data.currentAccountId || 'default_account'
    }
  },
  async setBotState (state, tabId = null, accountId = null) {
    const payload = { botState: state, activeTabId: tabId }
    if (accountId !== null) {
      payload.currentAccountId = accountId
    }
    await this.set(payload)
  }
}
