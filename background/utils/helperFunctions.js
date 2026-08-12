export function querySelectorAllDeep (selector, root = document) {
  let results = Array.from(root.querySelectorAll(selector))
  const allElements = root.querySelectorAll('*')

  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...querySelectorAllDeep(selector, el.shadowRoot))
    }
  }
  return results
}

export function querySelectorDeep (selector, root = document) {
  const matches = querySelectorAllDeep(selector, root)
  return matches.length > 0 ? matches[0] : null
}
