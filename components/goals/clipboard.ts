const copyTextWithTextareaFallback = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

export const writeTextToClipboard = async (text: string): Promise<void> => {
  const desktopClipboard = window.planwerkClipboard;
  if (desktopClipboard) {
    const result = await desktopClipboard.writeText(text);
    if (result.ok) return;
    throw new Error(result.message || result.reason || 'Planwerk clipboard write failed.');
  }

  let browserClipboardError: unknown = null;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      browserClipboardError = error;
    }
  }

  if (copyTextWithTextareaFallback(text)) return;

  if (browserClipboardError instanceof Error) throw browserClipboardError;
  throw new Error('Clipboard write failed.');
};
