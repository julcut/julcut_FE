export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[role="dialog"], [role="alertdialog"]')) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function isPanModifier(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey?: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey;
}
