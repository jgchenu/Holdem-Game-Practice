/** Preserve text-node identity when an optional diagnostic value is unchanged. */
export function setDiagnosticText(element: Element, value: string) {
  if (element.textContent !== value) element.textContent = value;
}
