// publish.js — save, list, delete client portals in Netlify Blobs
const { getStore } = require('@netlify/blobs');

function checkAuth(password) {
  const correct = process.env.ADMIN_PASSWORD || 'cms2025';
  return password === correct;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const password = event.headers['x-admin-password'] || '';
  if (!checkAuth(password)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const store = getStore({ name: 'portals', consistency: 'strong' });

  try {
    // GET — list all portals
    if (event.httpMethod === 'GET') {
      const result = await store.list({ paginate: false });
      const portals = await Promise.all((result.blobs || []).map(async function(b) {
        const meta = b.metadata || {};
        return {
          slug:        b.key,
          clientName:  meta.clientName  || b.key,
          updatedAt:   meta.updatedAt   || '',
          propCount:   meta.propCount   || 0,
        };
      }));
      portals.sort((a, b) => a.clientName.localeCompare(b.clientName));
      return { statusCode: 200, headers, body: JSON.stringify({ portals }) };
    }

    // POST — save a portal
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { slug, html, clientName, propCount } = body;

      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid slug — use lowercase letters, numbers, hyphens only.' }) };
      }
      if (!html || html.length < 200) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid HTML' }) };
      }

      await store.set(slug, html, {
        metadata: { slug, clientName: clientName || slug, updatedAt: new Date().toISOString(), propCount: propCount || 0 }
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, slug }) };
    }

    // DELETE — remove a portal
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { slug } = body;
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing slug' }) };
      await store.delete(slug);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('Publish error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
