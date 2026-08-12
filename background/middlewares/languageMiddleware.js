export async function checkLanguageMiddleware (tabId) {
  try {
    const langCheck = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const searchNav = document.querySelector(
          'artdeco-pill, .search-reusables__filter-keyword-pill-container, .global-nav'
        )
        const navText = searchNav
          ? searchNav.innerText.toLowerCase()
          : document.body.innerText.toLowerCase()

        return (
          navText.includes('people') ||
          navText.includes('connections') ||
          navText.includes('messaging') ||
          navText.includes('my network')
        )
      }
    })

    if (langCheck && langCheck[0]) {
      return langCheck[0].result
    }
  } catch (err) {
    console.warn('Language middleware execution failed, skipping check.')
  }
  return true
}
