const { getStore } = require('@netlify/blobs');

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

  try {
    const store = getStore({ name: 'portals', consistency: 'strong' });

    // GET — list all portals
    if (event.httpMethod === 'GET') {
      const result = await store.list({ paginate: false });
      const portals = (result.blobs || []).map(b => ({
        slug:       b.key,
        clientName: (b.metadata && b.metadata.clientName) || b.key,
        updatedAt:  (b.metadata && b.metadata.updatedAt)  || '',
        propCount:  (b.metadata && b.metadata.propCount)  || 0,
      })).sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
      return { statusCode: 200, headers: H, body: JSON.stringify({ portals }) };
    }

    // POST — save a portal
    if (event.httpMethod === 'POST') {
      const { slug, html, clientName, propCount } = JSON.parse(event.body || '{}');
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid slug — use lowercase letters, numbers, hyphens only.' }) };
      }
      if (!html || html.length < 200) {
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid HTML' }) };
      }
      await store.set(slug, html, {
        metadata: { slug, clientName: clientName || slug, updatedAt: new Date().toISOString(), propCount: propCount || 0 }
      });
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true, slug }) };
    }

    // DELETE — remove a portal
    if (event.httpMethod === 'DELETE') {
      const { slug } = JSON.parse(event.body || '{}');
      if (!slug) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Missing slug' }) };
      await store.delete(slug);
      return { statusCode: 200, headers: H, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('portals error:', err.message);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
  }
};
