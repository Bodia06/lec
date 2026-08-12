export async function extractAccountInfoFromDOM () {
  let accountId = ''
  let name = ''
  let hasPremiumOffer = false

  const ariaEl = document.querySelector('[aria-label*=" Me"]')
  if (ariaEl) {
    const ariaLabel = ariaEl.getAttribute('aria-label') || ''
    const matchName = ariaLabel.match(/^(.+?)\s+Me$/)
    if (matchName && matchName[1]) {
      name = matchName[1].trim()
    }
  }

  function findMeButton () {
    for (const btn of document.querySelectorAll('button')) {
      for (const span of btn.querySelectorAll('span')) {
        if (span.innerText && span.innerText.trim() === 'Me') {
          return btn
        }
      }
    }
    return document.querySelector('[aria-label*=" Me"]')
  }

  let menuEl = document.querySelector('[role="menu"]')
  const meBtn = findMeButton()
  let openedByBot = false

  if (!menuEl && meBtn) {
    meBtn.click()
    await new Promise(r => setTimeout(r, 900))
    menuEl = document.querySelector('[role="menu"]')
    openedByBot = true
  }

  if (menuEl) {
    const profileLink = menuEl.querySelector('a[href*="/in/"]')
    if (profileLink) {
      const href = profileLink.getAttribute('href') || ''
      const match = href.match(/\/in\/([^/]+)/)
      if (match) accountId = match[1]

      if (!name || name === 'User') {
        for (const p of profileLink.querySelectorAll('p')) {
          const txt = (p.innerText || '').trim()
          if (
            txt &&
            !txt.includes('Student') &&
            !txt.includes('At ') &&
            txt.length < 35
          ) {
            name = txt
            break
          }
        }
      }
    }

    const menuText = menuEl.innerText || ''
    hasPremiumOffer =
      menuText.includes('1 month of Premium') ||
      menuText.includes('zł 0') ||
      menuText.includes('Premium for')

    if (openedByBot && meBtn) {
      meBtn.click()
      await new Promise(r => setTimeout(r, 400))
    }
  }

  if (!accountId && name) {
    accountId = name.toLowerCase().replace(/\s+/g, '-')
  }

  return { accountId, name, hasPremiumOffer }
}
