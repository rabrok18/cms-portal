// portals.js — Portal storage using JSONBin.io (free, no npm needed)
// 
// Setup: Create a free account at jsonbin.io, create a bin with {} as content,
// copy the bin ID and API key, set as env vars:
//   JSONBIN_BIN_ID   — the bin ID (looks like 65abc123...)
//   JSONBIN_API_KEY  — your JSONBin API key
//   ADMIN_PASSWORD   — your team's admin password (default: cms2025)

const BIN_ID       = process.env.JSONBIN_BIN_ID;
const JSONBIN_KEY  = process.env.JSONBIN_API_KEY;
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'cms2025';

function auth(event) {
  return (event.headers['x-admin-password'] || '') === ADMIN_PASS;
}

async function readBin() {
  if (!BIN_ID || !JSONBIN_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  });
  if (!res.ok) throw new Error(`JSONBin read failed (${res.status})`);
  const data = await res.json();
  return data.record || {};
}

async function writeBin(data) {
  if (!BIN_ID || !JSONBIN_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: 'PUT',
    headers: { 'X-Master-Key': JSONBIN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`JSONBin write failed (${res.status})`);
}

const jsonHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders, body: '' };

  if (!auth(event)) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // GET — list all portals
    if (event.httpMethod === 'GET') {
      const bin = await readBin();
      const portals = Object.values(bin).map(function(p) {
        // Don't send full HTML in list — just metadata
        return { slug: p.slug, clientName: p.clientName, updatedAt: p.updatedAt, propCount: p.propCount };
      }).sort(function(a, b) { return (a.clientName||'').localeCompare(b.clientName||''); });
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ portals }) };
    }

    // POST — save a portal
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { slug, html, clientName, propCount } = body;

      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid slug' }) };
      }
      if (!html || html.length < 200) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid HTML' }) };
      }

      const bin = await readBin();
      bin[slug] = { slug, html, clientName: clientName || slug, updatedAt: new Date().toISOString(), propCount: propCount || 0 };
      await writeBin(bin);

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, slug }) };
    }

    // DELETE — remove a portal
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { slug } = body;
      if (!slug) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing slug' }) };
      const bin = await readBin();
      delete bin[slug];
      await writeBin(bin);
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('Portals error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
