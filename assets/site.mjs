import {parseState} from './search.mjs';
import {loadListing} from './listing.mjs';
import {setupPaperReaders} from './paper-reader.mjs';

setupPaperReaders(document, window);

const storageKey = 'tazichengge-website-favourites-v1';
const status = document.querySelector('#site-status');
const announce = text => { status.textContent = text; };
let saved = new Set();
let storageAvailable = true;
try {
  const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(value)) saved = new Set(value.filter(x => typeof x === 'string'));
} catch { storageAvailable = false; }

function updateButtons() {
  document.querySelectorAll('[data-save]').forEach(button => {
    const selected = saved.has(button.dataset.save);
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = selected ? '已收藏' : '收藏此条';
    button.disabled = !storageAvailable;
  });
}
updateButtons();
if (!storageAvailable && document.querySelector('[data-save]')) announce('当前浏览器无法保存收藏；仍可复制或保存本页链接。');
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-save], [data-copy], [data-print]');
  if (!button) return;
  if (button.hasAttribute('data-print')) { window.print(); return; }
  if (button.hasAttribute('data-save')) {
    const id = button.dataset.save;
    const next = new Set(saved);
    next.has(id) ? next.delete(id) : next.add(id);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      saved = next;
      updateButtons();
      announce(saved.has(id) ? '已加入当前浏览器的收藏。' : '已取消收藏。');
    } catch { announce('收藏未保存：浏览器存储不可用。请保存本页链接。'); }
    return;
  }
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    announce('字形已复制。');
  } catch {
    const field = document.querySelector('#copy-glyph');
    field.hidden = false;
    field.focus();
    field.select();
    announce('请在下方文本框中手动复制字形。');
  }
});

const listing = document.querySelector('[data-listing]');
if (listing) {
  const mode = listing.dataset.listing;
  const state = parseState(location.search, mode);
  const form = document.querySelector('#filter-form');
  form.elements.q.value = state.q;
  if (form.elements.type) form.elements.type.value = state.type;
  form.elements.saved.checked = state.saved;
  if (form.elements.fulltext) form.elements.fulltext.checked = Boolean(state.fulltext);
  document.title = `${state.q ? state.q + ' · ' : ''}${mode === 'dictionary' ? '查字' : mode === 'library' ? '资料库' : '全站检索'} — 她字成歌`;
  async function refreshListing({focus = false} = {}) {
    listing.setAttribute('aria-busy', 'true');
    listing.innerHTML = '<p class="notice" role="status">正在载入检索结果…</p>';
    document.querySelector('#result-count').textContent = '正在检索…';
    const view = await loadListing(mode, state, saved, {storageAvailable});
    listing.innerHTML = view.markup;
    listing.setAttribute('aria-busy', 'false');
    document.querySelector('#result-count').textContent = view.count;
    if (focus) listing.focus();
  }
  listing.addEventListener('click', event => {
    if (event.target.closest('[data-retry]')) refreshListing({focus: true});
  });
  await refreshListing();
  const webLinks = document.querySelector('#web-links');
  if (webLinks && state.q) {
    const q = encodeURIComponent('女书 ' + state.q);
    webLinks.innerHTML = `<p>继续在来源网站检索：</p><a target="_blank" rel="noopener noreferrer" href="https://www.bing.com/search?q=${q}%20site%3Aihchina.cn">中国非遗网 ↗</a><a target="_blank" rel="noopener noreferrer" href="https://www.bing.com/search?q=${q}%20site%3Aunicode.org">Unicode ↗</a><span>由搜索引擎打开实时网页结果</span>`;
  }
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
