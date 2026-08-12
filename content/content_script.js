let lastProcessedCard = null

if (!window.__isTrustedListenerInstalled) {
  window.__isTrustedListenerInstalled = true
  ;['mousedown', 'mouseup', 'click'].forEach(eventType => {
    document.addEventListener(
      eventType,
      e => {
        const target =
          e.target.closest('button, a, div[role="button"]') || e.target
        const isTrusted = e.isTrusted

        console.log(
          `%c[CDP VERIFIER]%c ${e.type.toUpperCase()} %c| isTrusted: %c${isTrusted}%c | target:`,
          'color: #00bcd4; font-weight: bold;',
          'color: #e0e0e0; font-weight: bold;',
          'color: #888;',
          isTrusted
            ? 'color: #00e676; font-weight: bold;'
            : 'color: #ff1744; font-weight: bold;',
          'color: inherit;',
          target
        )
      },
      true
    )
  })
}

function querySelectorAllDeep (selector, root = document) {
  let results = Array.from(root.querySelectorAll(selector))
  const allElements = root.querySelectorAll('*')

  for (const el of allElements) {
    if (el.shadowRoot) {
      results = results.concat(querySelectorAllDeep(selector, el.shadowRoot))
    }
  }
  return results
}

function querySelectorDeep (selector, root = document) {
  const matches = querySelectorAllDeep(selector, root)
  return matches.length > 0 ? matches[0] : null
}

function getCardElements () {
  const items = querySelectorAllDeep(
    'div[role="listitem"], main ul > li, div[data-component-type="LazyColumn"] > div, section[aria-label]'
  )

  return items.filter(item => {
    const hasProfileLink =
      querySelectorAllDeep('a[href*="/in/"]', item).length > 0
    const hasInviteLink =
      querySelectorAllDeep(
        'a[aria-label*="connect"], a[href*="search-custom-invite"], button[aria-label*="Invite"], button[aria-label*="Connect"]',
        item
      ).length > 0
    return hasProfileLink || hasInviteLink
  })
}

function resolveButtonState (cardElement) {
  const cardText = (cardElement.innerText || '').toLowerCase()

  if (cardText.includes('pending') || cardText.includes('очікується')) {
    return { type: 'PENDING', element: null }
  }

  const allClickables = querySelectorAllDeep(
    'button, div[role="button"], span[role="button"]',
    cardElement
  )

  const connectTarget = allClickables.find(el => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase()
    const text = (el.innerText || '').trim().toLowerCase()

    const isInviteAria = aria.includes('invite') || aria.includes('connect')
    const isConnectText = text === 'connect' || text === 'connect'
    const isFollow = text.includes('follow') || aria.includes('follow')

    return (isInviteAria || isConnectText) && !isFollow
  })

  if (connectTarget) {
    return { type: 'DIRECT_CONNECT', element: connectTarget }
  }

  const allLinks = querySelectorAllDeep('a', cardElement)
  const inviteLink = allLinks.find(el => {
    const href = (el.getAttribute('href') || '').toLowerCase()
    const text = (el.innerText || '').trim().toLowerCase()
    const aria = (el.getAttribute('aria-label') || '').toLowerCase()
    return (
      href.includes('search-custom-invite') ||
      text === 'connect' ||
      aria.includes('connect')
    )
  })

  if (inviteLink) {
    return { type: 'DIRECT_CONNECT', element: inviteLink }
  }

  const moreTarget = allClickables.find(el => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase()
    const text = (el.innerText || '').toLowerCase()
    return (
      aria.includes('more actions') ||
      aria.includes('more') ||
      text.includes('more')
    )
  })

  if (moreTarget) {
    return { type: 'NEED_MORE_MENU', element: moreTarget }
  }

  return { type: 'NOT_AVAILABLE', element: null }
}

async function handleModal () {
  let activeModal = null

  for (let attempt = 0; attempt < 12; attempt++) {
    const modals = querySelectorAllDeep(
      '[role="dialog"], div[aria-modal="true"]'
    )

    activeModal = modals.find(m => {
      const text = (m.innerText || '').toLowerCase()
      return (
        text.includes('add a note') ||
        text.includes('invitation') ||
        text.includes('message')
      )
    })

    if (activeModal) break
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150))
  }

  if (!activeModal) {
    return { status: 'SUCCESS_DIRECT' }
  }

  const modalText = (activeModal.innerText || '').toLowerCase()

  if (
    modalText.includes('weekly invitation limit') ||
    modalText.includes('limit')
  ) {
    return { status: 'LIMIT_STOP' }
  }

  if (
    modalText.includes('enter their email') ||
    querySelectorAllDeep('input[type="email"]', activeModal).length > 0
  ) {
    closeModal(activeModal)
    return { status: 'SKIPPED_EMAIL_REQUIRED' }
  }

  const buttons = querySelectorAllDeep(
    'button, a, div[role="button"]',
    activeModal
  )
  const sendBtn = buttons.find(b => {
    const aria = (b.getAttribute('aria-label') || '').toLowerCase()
    const txt = (b.innerText || '').trim().toLowerCase()

    return (
      aria.includes('send without a note') ||
      aria.includes('send now') ||
      txt.includes('send without a note') ||
      txt === 'send' ||
      txt === 'send'
    )
  })

  if (sendBtn) {
    const rect = sendBtn.getBoundingClientRect()
    return {
      status: 'CLICK_SEND',
      coords: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    }
  }

  closeModal(activeModal)
  return { status: 'UNKNOWN_MODAL' }
}

function closeModal (modalElement) {
  const closeBtn = querySelectorAllDeep(
    'button[aria-label="Dismiss"], button[aria-label*="Close"], button[aria-label*="close"]',
    modalElement
  )[0]
  if (closeBtn) {
    closeBtn.click()
  }
}

async function verifyTargetPending () {
  if (!lastProcessedCard) return { success: true }

  const cardText = (lastProcessedCard.innerText || '').toLowerCase()
  const currentState = resolveButtonState(lastProcessedCard)

  const isPending =
    cardText.includes('pending') ||
    cardText.includes('pending') ||
    currentState.type === 'PENDING'
  return { success: isPending }
}

function getCurrentPageNumber () {
  const params = new URLSearchParams(location.search)
  return params.get('page') || '1'
}

if (typeof window.lastPageNum === 'undefined') {
  window.lastPageNum = getCurrentPageNumber()
}

if (typeof window.processedCardIds === 'undefined') {
  window.processedCardIds = new Set()
}

function getCardIdentifier (cardElement) {
  const profileLink = querySelectorDeep('a[href*="/in/"]', cardElement)
  if (profileLink) {
    return profileLink.getAttribute('href')
  }
  return cardElement.innerText.slice(0, 50)
}

if (!window.hasLinkedInBotListener) {
  window.hasLinkedInBotListener = true

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_NEXT_TARGET') {
      findNextTarget().then(sendResponse)
      return true
    }

    if (request.action === 'HANDLE_MODAL') {
      handleModal().then(sendResponse)
      return true
    }

    if (request.action === 'GO_NEXT_PAGE') {
      goToNextPage().then(sendResponse)
      return true
    }

    if (request.action === 'VERIFY_TARGET_PENDING') {
      verifyTargetPending().then(sendResponse)
      return true
    }
  })
}

async function findNextTarget () {
  const currentPage = getCurrentPageNumber()

  if (window.lastPageNum !== currentPage) {
    window.lastPageNum = currentPage
    window.processedCardIds.clear()
  }

  await new Promise(r => setTimeout(r, 800 + Math.random() * 500))

  const cards = getCardElements()

  if (cards.length === 0) {
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
    const retryCards = getCardElements()
    if (retryCards.length === 0) {
      return { status: 'NO_MORE_TARGETS' }
    }
  }

  const activeCards = getCardElements()

  for (const card of activeCards) {
    const cardId = getCardIdentifier(card)

    if (window.processedCardIds.has(cardId)) continue

    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await new Promise(r => setTimeout(r, 400 + Math.random() * 300))

    const state = resolveButtonState(card)

    if (state.type === 'PENDING' || state.type === 'NOT_AVAILABLE') {
      window.processedCardIds.add(cardId)
      continue
    }

    if (state.type === 'DIRECT_CONNECT') {
      state.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await new Promise(r => setTimeout(r, 500 + Math.random() * 300))

      window.processedCardIds.add(cardId)
      lastProcessedCard = card

      const rect = state.element.getBoundingClientRect()

      if (rect.width === 0 || rect.height === 0) {
        return { status: 'NO_MORE_TARGETS' }
      }

      return {
        status: 'TARGET_FOUND',
        coords: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      }
    }
  }

  return { status: 'NO_MORE_TARGETS' }
}

async function goToNextPage () {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 800))

  const nextBtn =
    querySelectorDeep(
      'button[aria-label*="Next"], button[aria-label*="next"], button[aria-label*="Next"], ' +
        'button[aria-label*="next page"], button[aria-label*="Next page"], ' +
        'button[data-testid="pagination-controls-next-button-visible"]'
    ) ||
    querySelectorAllDeep('button, a').find(el => {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase()
      const txt = (el.innerText || '').trim().toLowerCase()
      const testId = (el.getAttribute('data-testid') || '').toLowerCase()

      return (
        testId.includes('pagination-controls-next') ||
        testId.includes('next') ||
        txt === 'next' ||
        txt === 'next' ||
        aria.includes('next page') ||
        aria.includes('next page') ||
        aria.includes('next')
      )
    })

  if (nextBtn) {
    const isDisabled =
      nextBtn.getAttribute('disabled') !== null ||
      nextBtn.getAttribute('aria-disabled') === 'true' ||
      nextBtn.classList.contains('disabled') ||
      nextBtn.classList.contains('artdeco-pagination__button--disabled')

    const isVisible = nextBtn.offsetParent !== null

    if (isDisabled || !isVisible) {
      return { success: false, reason: 'END_OF_PAGES' }
    }

    nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await new Promise(r => setTimeout(r, 500 + Math.random() * 300))
    nextBtn.click()

    await new Promise(r => setTimeout(r, 2500 + Math.random() * 1000))
    return { success: true }
  }

  return { success: false, reason: 'NOT_FOUND' }
}
