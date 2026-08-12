export const StorageManager = {
  async getStats (accountId = 'default_account') {
    const today = new Date().toISOString().split('T')[0]
    const storageKey = `stats_${accountId}`

    const data = await chrome.storage.local.get([storageKey, 'lastDate'])
    const accountData = data[storageKey] || { dailyCount: 0, weeklyCount: 0 }

    if (data.lastDate !== today) {
      const newStats = {
        dailyCount: 0,
        weeklyCount: accountData.weeklyCount || 0,
        lastDate: today
      }
      await chrome.storage.local.set({
        [storageKey]: newStats,
        lastDate: today
      })
      return newStats
    }

    return {
      dailyCount: accountData.dailyCount || 0,
      weeklyCount: accountData.weeklyCount || 0,
      lastDate: today
    }
  },

  async incrementStats (accountId = 'default_account') {
    const stats = await this.getStats(accountId)
    const storageKey = `stats_${accountId}`

    await chrome.storage.local.set({
      [storageKey]: {
        dailyCount: stats.dailyCount + 1,
        weeklyCount: stats.weeklyCount + 1
      }
    })
  }
}
