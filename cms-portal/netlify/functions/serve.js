// serve.js — serves a client portal from JSONBin storage

exports.handler = async (event) => {
  try {
    const BIN = process.env.JSONBIN_BIN_ID;
    const KEY = process.env.JSONBIN_API_KEY;

    const slug = (event.path || '')
      .replace(/^\/portal\//, '')
      .replace(/\.html$/, '')
      .replace(/^\//, '')
      .trim();

    if (!slug) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };
    }

    if (!BIN || !KEY) {
      return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
        body: '<html><body style="font-family:sans-serif;padding:40px;color:#dc2626">Server not configured.</body></html>' };
    }

    const res = await fetch('https://api.jsonbin.io/v3/b/' + BIN + '/latest', {
      headers: { 'X-Master-Key': KEY }
    });

    if (!res.ok) {
      return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
        body: '<html><body style="font-family:sans-serif;padding:40px;color:#dc2626">Error loading data.</body></html>' };
    }

    const data = await res.json();
    const portal = (data.record || {})[slug];

    if (!portal || !portal.html) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
      body: portal.html,
    };

  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
      body: '<html><body style="font-family:sans-serif;padding:40px">Error: ' + err.message + '</body></html>' };
  }
};

function notFound() {
  return '<!DOCTYPE html><html><head><title>Not Found</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb}p{color:#6b7280;font-size:14px}</style></head><body><p>Please use the link provided by your service team.</p></body></html>';
}
