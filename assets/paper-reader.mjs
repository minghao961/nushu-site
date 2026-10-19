import {paperPageURL} from './paper-search.mjs';

const key = entry => 'tazichengge-paper-opening-v1:' + entry.id + ':' + entry.paper.sha256;

export function openingState(entry, storage) {
  let page;
  try { page = Number(storage.getItem(key(entry))); } catch { /* Reading still works without storage. */ }
  const remembered = Boolean(paperPageURL(entry, page));
  if (!remembered) page = 1;
  return {page, url: paperPageURL(entry, page), remembered};
}

export function rememberOpening(entry, page, storage) {
  if (!paperPageURL(entry, page)) return false;
  try { storage.setItem(key(entry), String(page)); return true; } catch { return false; }
}

export function setupPaperReaders(document, window) {
  for (const form of document.querySelectorAll('[data-paper-reader]')) {
    const entry = JSON.parse(form.dataset.paperReader);
    form.hidden = false;
    let storage;
    try { storage = window.localStorage; } catch { /* Storage may be disabled. */ }
    const state = openingState(entry, storage);
    const input = form.elements.page;
    const link = form.querySelector('[data-paper-open]');
    const message = form.querySelector('[data-paper-status]');
    const resume = form.querySelector('[data-paper-resume]');
    input.value = state.page;
    resume.textContent = state.remembered ? `上次选择打开：第 ${state.page} 页。` : '输入完整文件的 PDF 页码。';
    const update = () => {
      const url = paperPageURL(entry, Number(input.value));
      if (url) {
        link.href = '../' + url;
        link.removeAttribute('aria-disabled');
      } else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
      }
      return url;
    };
    update();
    input.addEventListener('input', update);
    const remember = () => {
      const saved = rememberOpening(entry, Number(input.value), storage);
      message.textContent = saved ? `已记住本次选择的第 ${input.value} 页；若未打开，请点击阅读链接。` : '本次位置未保存；仍可打开 PDF。';
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity() || !update()) return;
      remember();
      window.open(link.href, '_blank', 'noopener');
    });
    link.addEventListener('click', event => {
      if (!update()) { event.preventDefault(); input.reportValidity(); return; }
      remember();
    });
  }
}
