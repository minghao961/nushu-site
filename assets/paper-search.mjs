import {normalize, queryTerms} from './search.mjs';

export function paperPageURL(entry, page) {
  if (!Number.isSafeInteger(page) || page < 1 || page > entry.paper?.pages) return null;
  const part = entry.paper.parts.find(p => page >= p.startPage && page <= p.endPage);
  return part ? `assets/papers/${part.file}#page=${page - part.startPage + 1}` : null;
}

export function withPaperText(entries, index, query) {
  if (index.version !== 1 || !index.papers || typeof index.papers !== 'object') throw new Error('Invalid paper text index');
  const terms = queryTerms(query);
  return entries.map(entry => {
    if (!entry.paper || !terms.length) return entry;
    const source = index.papers[entry.id];
    if (!source || !Array.isArray(source.pages)) throw new Error('Missing paper text: ' + entry.id);
    const hits = source.pages.filter(p => terms.every(term => normalize(p.text).includes(term)));
    return {...entry, fullTextCount: hits.length, fullTextHits: hits.slice(0, 3).map(p => ({...p, url: paperPageURL(entry, p.page)})).filter(p => p.url)};
  });
}
