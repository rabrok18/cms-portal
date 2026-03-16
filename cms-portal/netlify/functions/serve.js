const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  try {
    const slug = (event.path || '')
      .replace(/^\/portal\//, '')
      .replace(/\.html$/, '')
      .replace(/^\//, '')
      .trim();

    if (!slug) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };
    }

    const store = getStore({ name: 'portals', consistency: 'strong' });
    const html = await store.get(slug);

    if (!html) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
      body: html,
    };

  } catch (err) {
    console.error('serve error:', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
      body: '<html><body style="font-family:sans-serif;padding:40px">Error: ' + err.message + '</body></html>' };
  }
};

function notFound() {
  return '<!DOCTYPE html><html><head><title>Not Found</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb}p{color:#6b7280;font-size:14px}</style></head><body><p>Please use the link provided by your service team.</p></body></html>';
}
