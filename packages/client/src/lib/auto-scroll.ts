const NEAR_BOTTOM_THRESHOLD = 64

export function isNearBottom(el: Element, threshold = NEAR_BOTTOM_THRESHOLD): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

export function scrollToBottom(el: Element): void {
  el.scrollTop = el.scrollHeight - el.clientHeight
}
