import { querySelectorAllDeep } from './helperFunctions.js'

export function getCardElements () {
  const items = querySelectorAllDeep(
    'div[role="listitem"], main ul > li, div[data-component-type="LazyColumn"] > div'
  )

  return items.filter(item => {
    const hasProfileLink =
      querySelectorAllDeep('a[href*="/in/"]', item).length > 0
    const hasInviteLink =
      querySelectorAllDeep(
        'a[aria-label*="connect"], a[href*="search-custom-invite"], button[aria-label*="Invite"]',
        item
      ).length > 0
    return hasProfileLink || hasInviteLink
  })
}

export function resolveButtonState (cardElement) {
  const cardText = (cardElement.innerText || '').toLowerCase()

  if (cardText.includes('pending')) {
    return { type: 'PENDING', element: null }
  }

  const allClickables = querySelectorAllDeep(
    'a, button, div[role="button"]',
    cardElement
  )

  const connectTarget = allClickables.find(el => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase()
    const href = (el.getAttribute('href') || '').toLowerCase()
    const text = (el.innerText || '').trim().toLowerCase()

    const isInviteAria = aria.includes('invite') && aria.includes('to connect')
    const isInviteHref = href.includes('search-custom-invite')
    const isConnectText = text === 'connect'

    return isInviteAria || isInviteHref || isConnectText
  })

  if (connectTarget) {
    return { type: 'DIRECT_CONNECT', element: connectTarget }
  }

  const moreTarget = allClickables.find(el => {
    const aria = (el.getAttribute('aria-label') || '').toLowerCase()
    return aria.includes('more actions') || aria.includes('more')
  })

  if (moreTarget) {
    return { type: 'NEED_MORE_MENU', element: moreTarget }
  }

  return { type: 'NOT_AVAILABLE', element: null }
}

export async function handleModal () {
  let activeModal = null

  for (let attempt = 0; attempt < 12; attempt++) {
    const modals = querySelectorAllDeep(
      '[class*="artdeco-modal"], [role="dialog"]'
    )

    activeModal = modals.find(m => {
      const text = (m.innerText || '').toLowerCase()
      return text.includes('add a note') || text.includes('invitation')
    })

    if (activeModal) break
    await new Promise(resolve => setTimeout(resolve, 250))
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
    'button[aria-label="Dismiss"], button[aria-label*="Close"]',
    modalElement
  )[0]
  if (closeBtn) closeBtn.click()
}
