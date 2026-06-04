javascript:(async () => {
  const HOST_RE = /(^|\.)biblememory\.com$/i;
  const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
  const HEADERS = ['Reference', 'Content', 'Version', 'Collection', 'DaysUntilNextReview', 'Interval'];
  const BUCKET_TO_DAYS = new Map([
    [-1, ''],
    [0, 1],
    [10, 2],
    [11, 3],
    [12, 4],
    [13, 5],
    [14, 6],
    [20, 7],
    [30, 14],
    [35, 21],
    [40, 30],
    [50, 60],
    [60, 90],
    [61, 120],
    [62, 150],
    [70, 180],
    [71, 210],
    [72, 240],
    [73, 270],
    [74, 300],
    [75, 330],
    [80, 365],
  ]);

  if (!HOST_RE.test(location.hostname)) {
    alert('Open BibleMemory.com, sign in, then run this bookmarklet there.');
    return;
  }

  const css = `
    #ruminate-export-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #ruminate-export-card{width:min(560px,calc(100vw - 32px));background:#fff;color:#1f2933;border-radius:8px;box-shadow:0 20px 70px rgba(0,0,0,.25);padding:20px}
    #ruminate-export-card h2{font-size:20px;margin:0 0 8px}
    #ruminate-export-card p{margin:8px 0;color:#52616b}
    #ruminate-export-card dl{display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin:16px 0}
    #ruminate-export-card dt{color:#52616b}
    #ruminate-export-card dd{margin:0;font-weight:700}
    #ruminate-export-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    #ruminate-export-actions button{border:0;border-radius:6px;padding:10px 14px;font-weight:700;cursor:pointer}
    #ruminate-export-actions .primary{background:#c62828;color:white}
    #ruminate-export-actions .secondary{background:#eef2f5;color:#1f2933}
    #ruminate-export-log{max-height:130px;overflow:auto;background:#f5f7fa;border-radius:6px;padding:10px;font-size:12px;white-space:pre-wrap}
  `;

  let modal;
  let logEl;
  const logs = [];
  const log = (line) => {
    logs.push(line);
    if (logEl) logEl.textContent = logs.join('\n');
  };

  function installModal(bodyHtml) {
    document.querySelector('#ruminate-export-modal')?.remove();
    const style = document.createElement('style');
    style.textContent = css;
    modal = document.createElement('div');
    modal.id = 'ruminate-export-modal';
    modal.innerHTML = `<div id="ruminate-export-card">${bodyHtml}</div>`;
    document.body.append(style, modal);
    logEl = modal.querySelector('#ruminate-export-log');
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
  }

  async function fetchJson(path) {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const detail = data && typeof data.error === 'string' ? data.error : response.statusText;
      throw new Error(`${path} failed: ${response.status} ${detail}`);
    }
    return data;
  }

  function csvEscape(value) {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toCsv(rows) {
    return [
      HEADERS.join(','),
      ...rows.map((row) => HEADERS.map((header) => csvEscape(row[header])).join(',')),
    ].join('\r\n');
  }

  function intervalFromBucket(value) {
    const bucket = Number(value);
    if (!Number.isFinite(bucket)) return '';
    return BUCKET_TO_DAYS.has(bucket) ? BUCKET_TO_DAYS.get(bucket) : '';
  }

  function daysUntilNextReview(verse) {
    if (!verse || !verse.memorized) return '';
    if (verse.nextReviewOn) {
      const next = new Date(verse.nextReviewOn);
      if (!Number.isNaN(next.getTime())) {
        const today = new Date();
        const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const nextUtc = Date.UTC(next.getFullYear(), next.getMonth(), next.getDate());
        return Math.max(0, Math.min(365, Math.round((nextUtc - todayUtc) / 86400000)));
      }
    }
    const priority = Number(verse.priority ?? verse.minPriority);
    if (!Number.isFinite(priority) || priority > 10000) return '';
    if (priority <= 0) return 0;
    return Math.max(0, Math.min(365, Math.floor(priority)));
  }

  function collectionName(collection) {
    const name = String(collection?.categoryName ?? collection?.CategoryName ?? '').trim();
    if (!name || collection?.categoryGuid === ZERO_GUID || collection?.categoryGuid === 'master' || /^uncategorized$/i.test(name)) return '';
    return name;
  }

  async function fetchCollection(collection, seenCollections, rowsByKey, stats) {
    const guid = collection?.categoryGuid;
    if (!guid || seenCollections.has(guid)) return;
    seenCollections.add(guid);

    const name = collectionName(collection);
    log(`Fetching collection: ${name || 'Uncategorized'} (${guid})`);

    let page = 1;
    let totalPages = 1;
    do {
      const params = new URLSearchParams({ page: String(page), pageSize: '200', sort: 'custom' });
      const data = await fetchJson(`/api/collection/${encodeURIComponent(guid)}?${params.toString()}`);
      const actualCollection = data.collection || collection;
      const actualName = collectionName(actualCollection);

      for (const sub of data.subcollections || []) {
        stats.collections.add(sub.categoryGuid);
        await fetchCollection(sub, seenCollections, rowsByKey, stats);
      }

      for (const verse of data.verses || []) {
        const reference = String(verse.reference || '').trim();
        const content = String(verse.verseText || '').trim();
        if (!reference || !content) continue;

        const version = String(verse.abbreviation || verse.translation || '').trim();
        const interval = intervalFromBucket(verse.currentBucket);
        const days = daysUntilNextReview(verse);
        const sourceId = String(verse.memoryVerseGuid || verse.verseGuid || '').trim();
        const row = {
          Reference: reference,
          Content: content,
          Version: version,
          Collection: actualName,
          DaysUntilNextReview: days,
          Interval: interval,
        };
        const key = [sourceId || reference, version, actualName].join('\u001f');
        rowsByKey.set(key, row);
        stats.verses.add(sourceId || `${reference}\u001f${version}\u001f${content}`);
        if (days === '' || interval === '') stats.missingProgress += 1;
      }

      const pagination = data.versePagination;
      totalPages = pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);
  }

  try {
    installModal(`
      <h2>Ruminate BibleMemory Export</h2>
      <p>Exporting locally from your signed-in BibleMemory session...</p>
      <div id="ruminate-export-log"></div>
    `);

    const summary = await fetchJson('/api/myverses/collections');
    const initialCollections = [...(summary.collections || [])];
    if (summary.masterList) initialCollections.push(summary.masterList);
    if (initialCollections.length === 0) {
      throw new Error('No collections were returned. Try opening My Verses first, then run again.');
    }

    const stats = { collections: new Set(), verses: new Set(), missingProgress: 0 };
    const seenCollections = new Set();
    const rowsByKey = new Map();

    for (const collection of initialCollections) {
      stats.collections.add(collection.categoryGuid);
      await fetchCollection(collection, seenCollections, rowsByKey, stats);
    }

    const rows = [...rowsByKey.values()];
    const csv = toCsv(rows);
    const exportedAt = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ruminate-biblememory-export-${exportedAt}.csv`;

    installModal(`
      <h2>Ruminate BibleMemory Export</h2>
      <p>Export complete. Nothing was uploaded; CSV was generated locally in this page.</p>
      <dl>
        <dt>Verses found</dt><dd>${stats.verses.size}</dd>
        <dt>Collections found</dt><dd>${stats.collections.size}</dd>
        <dt>Rows exported</dt><dd>${rows.length}</dd>
        <dt>Rows missing progress</dt><dd>${stats.missingProgress}</dd>
      </dl>
      <div id="ruminate-export-log">${htmlEscape(logs.join('\n'))}</div>
      <div id="ruminate-export-actions">
        <button class="primary" id="ruminate-download">Download CSV</button>
        <button class="secondary" id="ruminate-copy">Copy CSV</button>
        <button class="secondary" id="ruminate-close">Close</button>
      </div>
    `);

    modal.querySelector('#ruminate-download').addEventListener('click', () => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

    modal.querySelector('#ruminate-copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(csv);
      modal.querySelector('#ruminate-copy').textContent = 'Copied';
    });

    modal.querySelector('#ruminate-close').addEventListener('click', () => modal.remove());
  } catch (error) {
    installModal(`
      <h2>Ruminate BibleMemory Export</h2>
      <p><strong>Export failed.</strong></p>
      <p>${htmlEscape(error instanceof Error ? error.message : String(error))}</p>
      <div id="ruminate-export-log">${htmlEscape(logs.join('\n'))}</div>
      <div id="ruminate-export-actions">
        <button class="secondary" id="ruminate-close">Close</button>
      </div>
    `);
    modal.querySelector('#ruminate-close').addEventListener('click', () => modal.remove());
  }
})();
