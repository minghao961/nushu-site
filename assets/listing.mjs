import {listingEntries, select, pageURL} from './search.mjs';
import {resultMarkup, escapeHTML} from './render.mjs';
import {withPaperText} from './paper-search.mjs';

// A failed request must never pass the build-time sample off as search results.
export async function loadListing(mode, state, saved, {fetcher = globalThis.fetch, timeoutMs = 15000, storageAvailable = true} = {}) {
  if (state.saved && !storageAvailable) {
    return {
      failed: true,
      count: '无法读取当前浏览器的收藏',
      markup: `<div class="empty-state"><h2>当前浏览器无法读取收藏</h2><p>请允许此网站使用本地存储后刷新页面，或先浏览全部内容。</p><a href="${escapeHTML(pageURL(mode + '.html', {...state, saved: false}))}">取消收藏筛选，继续检索</a></div>`
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher('assets/data/catalog.json', {signal: controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.characters) || !Array.isArray(data.records)) throw new Error('Invalid catalogue');
    let entries = listingEntries(data, mode, state);
    if (mode !== 'dictionary' && state.fulltext && state.q) {
      const textResponse = await fetcher('assets/data/paper-text.json', {signal: controller.signal});
      if (!textResponse.ok) throw new Error('Paper index HTTP ' + textResponse.status);
      entries = withPaperText(entries, await textResponse.json(), state.q);
    }
    const result = select(entries, state, 24, saved);
    return {
      failed: false,
      count: `共 ${result.total} 条${result.total ? ` · 第 ${result.page} / ${result.pages} 页` : ''}`,
      markup: (state.fulltext && mode !== 'dictionary' ? '<p class="notice">全文范围：六篇用户提供论文中可提取文字的页面；扫描图像及图中文字可能无法检索。页码为 PDF 文件页码。未勾选时只检索本站整理文字。</p>' : '') + resultMarkup(result, state, mode)
    };
  } catch {
    const directory = mode === 'dictionary' ? 'characters/index.html' : 'records/index.html';
    return {
      failed: true,
      count: controller.signal.aborted ? '检索数据加载超时' : state.fulltext ? '目录或论文全文索引未能载入' : '检索数据未能载入',
      markup: `<div class="empty-state"><h2>暂时无法载入检索结果</h2><p>请检查连接后重试，也可从完整目录直接阅读资料。</p><div class="recovery-actions"><button type="button" data-retry>重新加载</button><a href="${directory}">${mode === 'dictionary' ? '完整字形索引' : '完整资料目录'}</a><a href="offline-info.html">离线版本说明</a><a href="offline.html">旧版离线文件（不含新增论文）</a></div></div>`
    };
  } finally {
    clearTimeout(timer);
  }
}
