// CMS Portal - portals.js
// Storage: JSONBin.io — no npm dependencies

exports.handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  const pw = event.headers['x-admin-password'] || '';
  const correctPw = process.env.ADMIN_PASSWORD;
  if (!correctPw || pw !== correctPw) {
    return { statusCode: 401, headers: H, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const BIN = process.env.JSONBIN_BIN_ID;
  const KEY = process.env.JSONBIN_API_KEY;

  if (!BIN || !KEY) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'JSONBIN_BIN_ID and JSONBIN_API_KEY not configured in Netlify env vars' }) };
  }

  const BASE = 'https://api.jsonbin.io/v3/b/' + BIN;

  async function read() {
    const r = await fetch(BASE + '/latest', { headers: { 'X-Master-Key': KEY } });
    if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
    const d = await r.json();
    return d.record || {};
  }

  async function write(data) {
    const r = await fetch(BASE, {
      method: 'PUT',
      headers: { 'X-Master-Key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
  }

  try {
    if (event.httpMethod === 'GET') {
      const rec = await read();
      const portals = Object.values(rec)
        .map(p => ({ slug: p.slug, clientName: p.clientName, updatedAt: p.updatedAt, propCount: p.propCount }))
        .sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
      return { statusCode: 200, headers: H, body: JSON.stringify({ portals }) };
    }

    if (event.httpMethod === 'POST') {
      const { slug, html, clientName, propCount } = JSON.parse(event.body || '{}');
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid slug' }) };
      if (!html || html.length < 200) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid HTML' }) };
      const rec = await read();
      rec[slug] = { slug, html, clientName: clientName || slug, updatedAt: new Date().toISOString(), propCount: propCount || 0 };
      await write(rec);
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true, slug }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { slug } = JSON.parse(event.body || '{}');
      if (!slug) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Missing slug' }) };
      const rec = await read();
      delete rec[slug];
      await write(rec);
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('portals.js error:', err.message);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
  }
};
