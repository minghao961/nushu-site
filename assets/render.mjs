import {pageURL, queryTerms, normalize} from './search.mjs';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const kindNames = {character: '查字', photo: '照片资料', literature: '文献与档案', context: '背景条目', guide: '阅读指南', course: '入门阅读', community: '虚构创作示例', demo: '声音演示'};

// Match normalized characters, but mark and escape the original visible text.
export function highlight(value, query) {
  const text = String(value ?? ''), terms = queryTerms(query);
  if (!terms.length) return escapeHTML(text);
  const positions = [];
  let folded = '', offset = 0;
  for (const character of text) {
    const part = character.normalize('NFKC').toLowerCase();
    for (let i = 0; i < part.length; i++) positions.push([offset, offset + character.length]);
    folded += part;
    offset += character.length;
  }
  const ranges = [];
  for (const term of terms) for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + Math.max(1, term.length))) {
    ranges.push([positions[i][0], positions[i + term.length - 1][1]]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  let result = '', end = 0;
  for (const [start, stop] of merged) {
    result += escapeHTML(text.slice(end, start)) + '<mark>' + escapeHTML(text.slice(start, stop)) + '</mark>';
    end = stop;
  }
  return result + escapeHTML(text.slice(end));
}

export function hitSnippet(value, query, length = 150) {
  const text = String(value ?? '').replace(/\s+/g, ' ');
  const indices = queryTerms(query).map(term => normalize(text).indexOf(term)).filter(i => i >= 0);
  let start = Math.max(0, (indices.length ? Math.min(...indices) : 0) - 36);
  let end = Math.min(text.length, start + length);
  if (/[\uDC00-\uDFFF]/.test(text[start] || '')) start--;
  if (/[\uD800-\uDBFF]/.test(text[end - 1] || '')) end++;
  return (start ? '…' : '') + highlight(text.slice(start, end), query) + (end < text.length ? '…' : '');
}

export function characterCard(c, base = '', query = '') {
  return `<a class="character-card" href="${base}${escapeHTML(c.url)}"><span class="glyph" lang="zh-Nshu">${highlight(c.glyph, query)}</span><span class="character-reading">${highlight(c.reading, query)}</span><span class="character-hanzi">${highlight(c.hanzi, query)}</span><span class="code">${highlight(c.codepoint, query)}</span></a>`;
}

export function recordCard(e, base = '', query = '') {
  const sourceLabel = e.paper ? '用户提供论文 · ' + e.meta['作者'] + ' · ' + e.meta['年份'] + ' · 附 PDF' : e.photoId ? '用户提供照片 · 附文字整理' : e.kind === 'course' ? '本站整理' : ['community', 'demo'].includes(e.kind) ? '本站原创演示 · 非历史资料' : '附来源链接';
  const passage = query && e.body?.find(text => queryTerms(query).some(term => normalize(text).includes(term)));
  const textHits = e.fullTextHits?.length ? `<ul class="fulltext-hits" aria-label="论文全文命中">${e.fullTextHits.map(hit => `<li><a href="${base}${escapeHTML(hit.url)}" target="_blank" rel="noopener">PDF 文件第 ${hit.page} 页 ↗</a><p>${hitSnippet(hit.text, query)}</p></li>`).join('')}</ul><p class="small-note">${e.fullTextCount} 页命中${e.fullTextCount > 3 ? '，显示前3页' : ''} · 按 PDF 文件页码定位</p>` : '';
  const cover = e.paper?.cover ? `<a class="paper-cover-link" href="${base}${escapeHTML(e.url)}" tabindex="-1" aria-hidden="true"><img class="paper-cover-thumb" src="${base}${escapeHTML(e.paper.cover)}" alt="" width="112" height="154" loading="lazy" decoding="async"></a>` : '';
  return `<article class="record-card${e.photoId ? ' has-photo' : ''}${cover ? ' has-paper-cover' : ''}">${e.photoId ? `<a class="record-image" href="${base}${escapeHTML(e.url)}" tabindex="-1" aria-hidden="true"><img src="${base}assets/images/${e.photoId}.jpg" alt="" loading="lazy" decoding="async"></a>` : ''}${cover}<div class="record-content"><p class="eyebrow">${kindNames[e.kind] || '资料'} <span> / ${escapeHTML(e.category)}</span></p><h3><a href="${base}${escapeHTML(e.url)}">${highlight(e.title, query)}</a></h3><p>${highlight(e.summary, query)}</p><span class="source-line">${highlight(sourceLabel, query)}</span>${passage ? `<p class="search-excerpt"><span>整理文字：</span>${hitSnippet(passage, query)}</p>` : ''}${textHits}</div></article>`;
}

export function pagination(result, state, base) {
  if (result.pages < 2) return '';
  const numbers = new Set([1, result.pages]);
  for (let i = Math.max(1, result.page - 2); i <= Math.min(result.pages, result.page + 2); i++) numbers.add(i);
  let last = 0;
  const links = [...numbers].sort((a, b) => a - b).map(page => {
    const gap = page - last > 1 ? '<span class="page-gap">…</span>' : '';
    last = page;
    return gap + `<a href="${escapeHTML(pageURL(base, state, page))}"${page === result.page ? ' aria-current="page"' : ''} aria-label="第 ${page} 页">${page}</a>`;
  }).join('');
  return `<nav class="pagination" aria-label="结果分页">${result.page > 1 ? `<a href="${escapeHTML(pageURL(base, state, result.page - 1))}">上一页</a>` : ''}${links}${result.page < result.pages ? `<a href="${escapeHTML(pageURL(base, state, result.page + 1))}">下一页</a>` : ''}</nav>`;
}

export function resultMarkup(result, state, mode) {
  const characters = result.items.filter(e => e.kind === 'character');
  const records = result.items.filter(e => e.kind !== 'character');
  const characterGrid = characters.length ? `<div class="character-grid">${characters.map(c => characterCard(c, '', state.q)).join('')}</div>` : '';
  const recordGrid = records.length ? `<div class="record-grid">${records.map(e => recordCard(e, '', state.q)).join('')}</div>` : '';
  const group = (id, title, count, grid) => count ? `<section class="result-group" aria-labelledby="${id}"><h2 id="${id}">${title}<span>本页 ${count} 条</span></h2>${grid}</section>` : '';
  const cards = mode === 'search' ? group('character-results-title', '字形词条', characters.length, characterGrid) + group('record-results-title', '资料与阅读', records.length, recordGrid) : characterGrid + recordGrid;
  const empty = `<div class="empty-state"><h2>${state.saved ? '还没有符合条件的收藏' : '没有找到相关结果'}</h2><p>${state.saved ? '可尝试清除关键词或类型筛选。在字形或资料详情页点击“收藏”，即可保存在当前浏览器。' : '试试一个汉字、女书字形、读音或更短的关键词。表内对应并不覆盖所有汉字。'}</p><a href="${mode}.html">${mode === 'dictionary' ? '查看全部字形' : mode === 'search' ? '查看全部内容' : '查看全部资料'}</a></div>`;
  return `${result.total ? cards : empty}${pagination(result, state, mode + '.html')}`;
}
