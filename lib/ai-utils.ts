export function findTextSpan(fullText: string, searchText: string, usedPositions: Set<number>): { start: number; end: number } | null {
  let start = -1
  let searchFrom = 0

  while (true) {
    const foundPos = fullText.indexOf(searchText, searchFrom)
    if (foundPos === -1) break

    if (!usedPositions.has(foundPos)) {
      start = foundPos
      usedPositions.add(foundPos)
      break
    }

    searchFrom = foundPos + 1
  }

  if (start === -1) {
    // Fallback for when the exact text isn't found (e.g., AI trims whitespace)
    const trimmedSearchText = searchText.trim()
    if (trimmedSearchText !== searchText) {
        return findTextSpan(fullText, trimmedSearchText, usedPositions)
    }
    console.warn(`Could not find unused position for "${searchText}" in original text`)
    return null
  }

  return { start, end: start + searchText.length }
} 