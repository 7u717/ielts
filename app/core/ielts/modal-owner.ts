function isModalDialog(dialog: HTMLDialogElement): boolean {
  if (!dialog.open) return false
  try {
    return dialog.matches(':modal')
  } catch {
    return false
  }
}

// The last modal in tree order is the one most recently opened with showModal.
export function topmostModalDialog(doc: Document): HTMLDialogElement | null {
  const modals = [...doc.querySelectorAll('dialog')].filter((node): node is HTMLDialogElement => {
    return node.localName === 'dialog' && isModalDialog(node as HTMLDialogElement)
  })
  return modals.at(-1) ?? null
}

export type HitOwner = 'dialog' | 'panel' | 'outside'

// A native modal dialog owns the hit, including its controls and the inert page
// behind it. The floating sheet must not treat those hits as an outside dismiss.
function asNode(target: EventTarget | null): Node | null {
  if (!target || typeof (target as Node).nodeType !== 'number') return null
  return target as Node
}

export function hitOwner(target: EventTarget | null, panel: Element | null, doc: Document): HitOwner {
  const node = asNode(target)
  const modal = topmostModalDialog(doc)
  if (modal) {
    if (node && (modal === node || modal.contains(node))) return 'dialog'
    return 'dialog'
  }
  if (node && panel?.contains(node)) return 'panel'
  return 'outside'
}
