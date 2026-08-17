document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('startBtn')
  const stopBtn = document.getElementById('stopBtn')
  const clearLogBtn = document.getElementById('clearLog')
  const statusBadge = document.getElementById('statusBadge')
  const statusText = document.getElementById('statusText')
  const statsLabel = document.getElementById('statsLabel')
  const dailyCountEl = document.getElementById('dailyCount')
  const totalLimitEl = document.getElementById('totalLimit')
  const progressFill = document.getElementById('progressFill')
  const progressBar = document.querySelector('.progress-bar')
  const logContainer = document.getElementById('log')
  const modeBtns = document.querySelectorAll('.mode-btn')

  let currentMode = 'CONNECT'

  const storedConfig = await chrome.storage.local.get(['selectedMode'])
  if (storedConfig.selectedMode) {
    currentMode = storedConfig.selectedMode
    setActiveMode(currentMode)
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode
      currentMode = mode
      setActiveMode(mode)
      await chrome.storage.local.set({ selectedMode: mode })
      await updateStats()
    })
  })

  function setActiveMode (mode) {
    modeBtns.forEach(b => {
      if (b.dataset.mode === mode) {
        b.classList.add('active')
      } else {
        b.classList.remove('active')
      }
    })
    if (statsLabel) {
      statsLabel.textContent =
        mode === 'LIKE' ? 'Daily Like Limit' : 'Daily Connect Limit'
    }
  }

  chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => {
    if (response) {
      updateUIState(response.isRunning)
      if (response.logs && response.logs.length > 0) {
        logContainer.innerHTML = ''
        response.logs.forEach(log => appendLogToDOM(log))
      }
    }
  })

  async function updateStats () {
    chrome.runtime.sendMessage(
      { action: 'GET_CURRENT_ACCOUNT', mode: currentMode },
      async response => {
        const activeAcc = response?.accountId || 'default_account'
        const max = response?.maxDaily || 10

        const storageKey = `stats_${activeAcc}_${currentMode}`
        const data = await chrome.storage.local.get([storageKey])
        const accountStats = data[storageKey] || { dailyCount: 0 }
        const count = accountStats.dailyCount || 0

        dailyCountEl.textContent = count
        if (totalLimitEl) totalLimitEl.textContent = max

        const percentage = Math.min(100, Math.round((count / max) * 100))
        progressFill.style.width = `${percentage}%`
        if (progressBar) progressBar.setAttribute('aria-valuenow', percentage)
      }
    )
  }

  await updateStats()

  chrome.runtime.onMessage.addListener(message => {
    if (message.action === 'LOG') {
      appendLogToDOM(message.text)
      updateStats()
    } else if (message.action === 'STOPPED') {
      updateUIState(false)
      updateStats()
    } else if (message.action === 'LOGS_CLEARED') {
      logContainer.innerHTML = 'System logs cleared.'
      updateStats()
    }
  })

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab || !tab.url || !tab.url.includes('linkedin.com')) {
      appendLogToDOM(
        '[ERROR] Please open a LinkedIn page (Search or Feed) to start automation!'
      )
      return
    }

    updateUIState(true)
    chrome.runtime.sendMessage({
      action: 'START',
      tabId: tab.id,
      mode: currentMode
    })
  })

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP' }, () => {
      updateUIState(false)
    })
  })

  clearLogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' }, () => {
      logContainer.innerHTML = 'System logs cleared.'
      updateStats()
    })
  })

  function updateUIState (isRunning) {
    modeBtns.forEach(btn => (btn.disabled = isRunning))
    if (isRunning) {
      statusBadge.classList.add('active')
      statusText.textContent = 'Running'
      startBtn.disabled = true
      stopBtn.disabled = false
    } else {
      statusBadge.classList.remove('active')
      statusText.textContent = 'Ready'
      startBtn.disabled = false
      stopBtn.disabled = true
    }
  }

  function appendLogToDOM (text) {
    if (
      logContainer.innerHTML === 'System logs will appear here...' ||
      logContainer.innerHTML === 'System logs cleared.'
    ) {
      logContainer.innerHTML = ''
    }

    const div = document.createElement('div')
    div.style.marginBottom = '2px'

    if (text.includes('[SUCCESS]')) {
      div.style.color = '#3fb950'
    } else if (text.includes('[ERROR]')) {
      div.style.color = '#f85149'
    } else if (text.includes('[WARN]')) {
      div.style.color = '#d29922'
    } else {
      div.style.color = '#7ee787'
    }

    div.textContent = text
    logContainer.appendChild(div)
    logContainer.scrollTop = logContainer.scrollHeight
  }
})
