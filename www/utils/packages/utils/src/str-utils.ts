export function getHTMLChar(str: string) {
  return str
    .replace(/</g, "&#60;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;")
    .replace(/>/g, "&#62;")
}

export function escapeChars(str: string, escapeBackticks = true) {
  const codeRegex = /(`[^`]*`)/g
  let result = ""
  let lastIndex = 0

  str.replace(codeRegex, (match, p1, offset) => {
    result += getHTMLChar(str.slice(lastIndex, offset))
      .replace(/\|/g, "\\|")
      .replace(/`/g, escapeBackticks ? "\\`" : "`")
      .replace(/_/g, "\\_")
    result += p1 // keep the inline code block as is
    lastIndex = offset + match.length
    return match
  })

  result += getHTMLChar(str.slice(lastIndex))
    .replace(/\|/g, "\\|")
    .replace(/`/g, escapeBackticks ? "\\`" : "`")
    .replace(/_/g, "\\_")

  return result
}

export function stripLineBreaks(str: string) {
  return str
    ? str
        .replace(/\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        .replace(/[\s]{2,}/g, " ")
        .trim()
    : ""
}

export function getUniqueStrArray(str: string[]): string[] {
  return Array.from(new Set(str))
}
