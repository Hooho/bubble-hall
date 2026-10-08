/**
 * In-game replacements for window.alert / window.confirm, styled like the pause card.
 * Both return promises; Esc / backdrop cancel, Enter activates the focused button.
 */

type DialogOptions = { title: string; body?: string; confirmText?: string; cancelText?: string | null; danger?: boolean };

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function showDialog({ title, body = '', confirmText = '确定', cancelText = '取消', danger = false }: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'modal-layer app-dialog-layer';
    layer.innerHTML = `<div class="pause-card app-dialog" role="${cancelText ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="app-dialog-title">
      <h2 id="app-dialog-title">${escapeHtml(title)}</h2>${body ? `<p>${escapeHtml(body)}</p>` : ''}
      <div class="modal-actions">
        <button class="button ${danger ? 'button-danger' : 'button-primary'}" data-dialog="ok">${escapeHtml(confirmText)}</button>
        ${cancelText ? `<button class="button button-ghost" data-dialog="cancel">${escapeHtml(cancelText)}</button>` : ''}
      </div></div>`;
    const previous = document.activeElement as HTMLElement | null;
    const close = (result: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      layer.remove();
      previous?.focus?.();
      resolve(result);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(false); }
    };
    layer.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-dialog]');
      if (target) close(target.dataset.dialog === 'ok');
      else if (event.target === layer && cancelText) close(false);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.append(layer);
    // dangerous actions default focus to cancel, so Enter-mashing never wipes progress
    layer.querySelector<HTMLButtonElement>(danger && cancelText ? '[data-dialog="cancel"]' : '[data-dialog="ok"]')?.focus();
  });
}

export function notify(title: string, body = ''): Promise<boolean> {
  return showDialog({ title, body, confirmText: '知道了', cancelText: null });
}
