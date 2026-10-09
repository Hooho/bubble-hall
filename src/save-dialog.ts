import './save-dialog.css';
import { downloadSaveFile } from '../../../packages/game-common/src/storage/transfer';
import type { createSaveStore } from './shared/save-store';
import { savedMatchSlots, type Save } from './save';

type Transfer = ReturnType<typeof createSaveStore<Save>>['transfer'];

/** Bubble's own UI; common supplies data transfer only. Parsing never writes. */
export function openSaveDialog(options: {
  mode: 'export' | 'import';
  transfer: Transfer;
  snapshot: () => Save;
  replace: (save: Save) => Promise<void>;
  initialImport?: Save;
}): void {
  if (document.querySelector('.save-dialog')) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const exporting = options.mode === 'export';
  const dialog = document.createElement('dialog');
  dialog.className = 'save-dialog';
  dialog.setAttribute('aria-labelledby', 'save-dialog-title');
  dialog.innerHTML = `
    <header class="save-dialog-header"><span class="save-dialog-emblem" aria-hidden="true">↥</span><button class="icon-button" type="button" data-close aria-label="关闭存档窗口">×</button></header>
    <p class="eyebrow">BUBBLE CLUB · SAVE CAPSULE</p>
    <h2 id="save-dialog-title">${exporting ? '把进度带走。' : '接着上次玩。'}</h2>
    <p class="save-dialog-intro">${exporting ? '文件与存档码包含相同进度。选一种方式保存，换设备也能接着玩。' : '选择泡泡堂存档文件，或粘贴存档码。校验后再确认，不会立即覆盖进度。'}</p>
    ${exporting ? '<button type="button" class="button save-file-action" data-download><span>↓ 导出 JSON 文件</span><small>保存到本机 · 推荐</small></button>' : '<label class="save-file-action button"><span>↑ 选择 JSON 存档文件</span><input type="file" accept=".json,application/json" aria-label="选择 JSON 存档文件" data-file></label>'}
    <div class="save-divider"><span>或使用存档码</span></div>
    <label class="save-code-label" for="bubble-save-code">${exporting ? '本次进度的存档码' : '粘贴存档码'}</label>
    <textarea id="bubble-save-code" class="save-code-input" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="10000000" ${exporting ? 'readonly' : 'placeholder="BUBBLE-SAVE-V1.…"'}></textarea>
    <p class="save-feedback" role="status" aria-live="polite"></p>
    <section class="save-import-preview" hidden><strong>存档已通过校验</strong><p data-summary></p><p>将替换本游戏的积分、设置、单次赛和冠军赛进度；当前进度会保留备份。</p></section>
    <footer class="save-dialog-actions"><button type="button" class="button button-ghost" data-close>取消</button><button type="button" class="button button-primary" data-primary ${exporting ? 'disabled' : ''}>${exporting ? '复制存档码' : '校验存档码'}</button><button type="button" class="button button-primary" data-confirm hidden>确认替换进度</button></footer>`;
  const textarea = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
  const primary = dialog.querySelector<HTMLButtonElement>('[data-primary]')!;
  const confirm = dialog.querySelector<HTMLButtonElement>('[data-confirm]')!;
  const preview = dialog.querySelector<HTMLElement>('.save-import-preview')!;
  const feedback = dialog.querySelector<HTMLElement>('.save-feedback')!;
  let candidate: Save | null = null;
  let generation = 0;
  let committing = false;
  const status = (message: string, error = false) => { feedback.textContent = message; feedback.classList.toggle('is-error', error); };
  const fail = (error: unknown) => status(error instanceof Error ? error.message : '操作失败，请重试', true);
  const invalidate = () => {
    generation++; candidate = null; preview.hidden = true; confirm.hidden = true; primary.hidden = false; primary.disabled = false;
  };
  const stage = (save: Save) => {
    candidate = save;
    const slots = savedMatchSlots(save);
    dialog.querySelector<HTMLElement>('[data-summary]')!.textContent = `积分 ${save.career.points.player ?? 0} · 已完成 ${save.career.history.length} 场 · 单次赛${slots.quick ? '可继续' : '无进行中对局'} · 冠军赛${slots.championship || (save.tournament && save.tournament.round !== 'complete') ? '可继续' : '无进行中赛事'}`;
    preview.hidden = false; confirm.hidden = false; primary.hidden = true;
    status('请确认下面的进度信息，再选择是否替换。');
    confirm.focus();
  };
  const check = async (parse: () => Promise<Save>) => {
    invalidate(); const request = generation;
    primary.disabled = true; status('正在校验存档…');
    try { const save = await parse(); if (dialog.open && generation === request) stage(save); }
    catch (error) { if (dialog.open && generation === request) fail(error); }
    finally { if (generation === request) primary.disabled = false; }
  };
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (!committing) dialog.close(); }));
  dialog.addEventListener('cancel', event => { if (committing) event.preventDefault(); });
  dialog.addEventListener('close', () => { generation++; dialog.remove(); if (opener?.isConnected) opener.focus(); });
  textarea.addEventListener('input', () => { invalidate(); status(''); });
  dialog.querySelector<HTMLInputElement>('[data-file]')?.addEventListener('change', event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if (file) { textarea.value = ''; void check(() => options.transfer.parseFile(file)); }
  });
  let exported: Save | null = null;
  dialog.querySelector('[data-download]')?.addEventListener('click', () => {
    try {
      exported ??= options.snapshot();
      downloadSaveFile(options.transfer.exportJSON(exported), `泡泡大作战-${new Date().toISOString().slice(0, 10)}.json`);
      status('已发起文件下载，请在浏览器下载记录中确认。');
    } catch (error) { fail(error); }
  });
  primary.addEventListener('click', async () => {
    if (!exporting) {
      if (!textarea.value.trim()) { status('请先粘贴存档码，或选择存档文件。', true); textarea.focus(); return; }
      const code = textarea.value;
      await check(() => options.transfer.parseCode(code)); return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(textarea.value); status('存档码已复制。建议粘贴到备忘录保存。');
    } catch {
      textarea.focus(); textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
      status('浏览器未允许自动复制，已选中存档码，请手动复制。');
    }
  });
  confirm.addEventListener('click', async () => {
    if (!candidate || committing) return;
    committing = true;
    dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>('button,input,textarea').forEach(control => { control.disabled = true; });
    try { await options.replace(candidate); dialog.close(); }
    catch (error) { fail(error); }
    finally {
      committing = false;
      dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>('button,input,textarea').forEach(control => { control.disabled = false; });
    }
  });
  document.body.append(dialog); dialog.showModal();
  if (exporting) {
    status('正在生成存档码…');
    void (async () => {
      try {
        exported = options.snapshot();
        const code = await options.transfer.createCode(exported);
        if (dialog.open) { textarea.value = code; primary.disabled = false; status('包含积分、设置，以及两种模式的未完成进度。'); }
      } catch (error) { if (dialog.open) fail(error); }
    })();
  } else if (options.initialImport) stage(options.initialImport);
  else textarea.focus();
}
