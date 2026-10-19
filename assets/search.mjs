export const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export const queryTerms = value => [...new Set(normalize(value).split(/\s+/).filter(Boolean))];

export function matches(entry, query) {
  const terms = queryTerms(query);
  const haystack = normalize(entry.searchText ?? [entry.title, entry.summary, ...(entry.body || [])].join(' '));
  return terms.every(term => haystack.includes(term));
}

export function parseState(search, mode = 'search') {
  const params = new URLSearchParams(search);
  const rawPage = Number(params.get('page'));
  const types = mode === 'dictionary' ? ['all'] : ['all', 'photo', 'literature', 'context', 'guide', ...(mode === 'search' ? ['character'] : [])];
  const type = params.get('type');
  return {
    q: (params.get('q') || '').trim().slice(0, 200),
    type: types.includes(type) ? type : 'all',
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    saved: params.get('saved') === '1',
    ...(mode !== 'dictionary' && params.get('fulltext') === '1' ? {fulltext: true} : {})
  };
}

export function listingEntries(data, mode, state = {}) {
  if (mode === 'dictionary') return data.characters;
  const priority = {photo: 0, literature: 1, context: 2, guide: 3};
  const library = data.records.filter(e => e.library).sort((a, b) => priority[a.kind] - priority[b.kind]);
  if (mode === 'library') return library;
  return [...data.characters, ...(state.saved ? data.records : library)];
}

export function select(entries, state, pageSize = 24, saved = new Set()) {
  const filtered = entries.filter(e => (!state.type || state.type === 'all' || e.kind === state.type)
    && (!state.saved || saved.has(e.id)) && (matches(e, state.q) || e.fullTextHits?.length));
  const q = normalize(state.q);
  if (q) {
    const terms = queryTerms(q);
    const score = e => (e.glyph === q || normalize(e.hanzi) === q ? 10000 : 0)
      + (normalize(e.title) === q ? 1000 : 0)
      + terms.reduce((sum, term) => sum + (normalize(e.title).includes(term) ? 100 : 0)
        + (normalize(e.meta?.['作者']).includes(term) ? 80 : 0)
        + (normalize(e.meta?.['关键词']).includes(term) ? 50 : 0)
        + (normalize(e.summary).includes(term) ? 20 : 0), 0);
    filtered.sort((a, b) => score(b) - score(a));
  }
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(state.page) ? state.page : 1));
  return {items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, pages, page};
}

export function pageURL(base, state, page = 1) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.type && state.type !== 'all') params.set('type', state.type);
  if (state.saved) params.set('saved', '1');
  if (state.fulltext) params.set('fulltext', '1');
  if (page > 1) params.set('page', String(page));
  return base + (params.size ? '?' + params : '');
}
