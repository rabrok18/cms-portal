// portals.js — Netlify Blobs REST API (no npm deps required)
// Handles: portals CRUD + property sync storage

const PORTAL_STORE = 'portals';
const PROPS_STORE  = 'properties';

function blobBase(siteID, store) {
  return `https://api.netlify.com/api/v1/blobs/${siteID}/${store}`;
}

async function blobGet(siteID, token, store, key) {
  const r = await fetch(`${blobBase(siteID, store)}/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Blob GET failed: ${r.status}`);
  return r.text();
}

async function blobPut(siteID, token, store, key, body, contentType='text/plain') {
  const r = await fetch(`${blobBase(siteID, store)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body
  });
  if (!r.ok) throw new Error(`Blob PUT failed: ${r.status} ${await r.text()}`);
}

async function blobDelete(siteID, token, store, key) {
  const r = await fetch(`${blobBase(siteID, store)}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok && r.status !== 404) throw new Error(`Blob DELETE failed: ${r.status}`);
}

async function blobList(siteID, token, store) {
  const r = await fetch(`${blobBase(siteID, store)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`Blob LIST failed: ${r.status}`);
  const d = await r.json();
  return d.blobs || d.items || d || [];
}

const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Action',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  const pw = event.headers['x-admin-password'] || '';
  if (pw !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: H, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) {
    return { statusCode: 500, headers: H, body: JSON.stringify({
      error: 'Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN',
      hasSiteID: !!siteID, hasToken: !!token
    })};
  }

  const action = event.headers['x-action'] || 'portals';

  try {
    // ── PROPERTIES ────────────────────────────────────────────────
    if (action === 'get-properties') {
      const data = await blobGet(siteID, token, PROPS_STORE, 'all');
      const props = data ? JSON.parse(data) : [];
      return { statusCode: 200, headers: H, body: JSON.stringify({ properties: props }) };
    }

    if (action === 'save-properties' && event.httpMethod === 'POST') {
      const { properties } = JSON.parse(event.body || '{}');
      if (!Array.isArray(properties)) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid properties' }) };
      await blobPut(siteID, token, PROPS_STORE, 'all', JSON.stringify(properties), 'application/json');
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true, count: properties.length }) };
    }

    // ── PORTALS ───────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const blobs = await blobList(siteID, token, PORTAL_STORE);
      const portals = [];
      for (const b of blobs) {
        const key = b.key || b.id || b;
        if (key === '__meta') continue;
        try {
          const raw = await blobGet(siteID, token, PORTAL_STORE, key + '__meta');
          const meta = raw ? JSON.parse(raw) : { slug: key, clientName: key };
          portals.push(meta);
        } catch(e) {
          portals.push({ slug: key, clientName: key, updatedAt: '', propCount: 0 });
        }
      }
      portals.sort((a, b) => (a.clientName||'').localeCompare(b.clientName||''));
      return { statusCode: 200, headers: H, body: JSON.stringify({ portals }) };
    }

    if (event.httpMethod === 'POST') {
      const { slug, html, clientName, propCount } = JSON.parse(event.body || '{}');
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid slug — lowercase letters, numbers, hyphens only.' }) };
      }
      if (!html || html.length < 200) {
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid HTML' }) };
      }
      // Save HTML
      await blobPut(siteID, token, PORTAL_STORE, slug, html, 'text/html');
      // Save metadata separately
      const meta = { slug, clientName: clientName || slug, updatedAt: new Date().toISOString(), propCount: propCount || 0 };
      await blobPut(siteID, token, PORTAL_STORE, slug + '__meta', JSON.stringify(meta), 'application/json');
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true, slug }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { slug } = JSON.parse(event.body || '{}');
      if (!slug) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Missing slug' }) };
      await blobDelete(siteID, token, PORTAL_STORE, slug);
      await blobDelete(siteID, token, PORTAL_STORE, slug + '__meta');
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('portals error:', err.message);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
  }
};
