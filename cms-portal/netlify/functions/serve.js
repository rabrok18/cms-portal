// serve.js — serves client portal from Netlify Blobs REST API

exports.handler = async (event) => {
  try {
    const slug = (event.path || '')
      .replace(/^\/portal\//, '').replace(/\.html$/, '').replace(/^\//, '').trim();

    if (!slug) return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };

    const siteID = process.env.NETLIFY_SITE_ID;
    const token  = process.env.NETLIFY_AUTH_TOKEN;
    if (!siteID || !token) return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: '<html><body style="font-family:sans-serif;padding:40px;color:#dc2626">Missing server config: NETLIFY_SITE_ID / NETLIFY_AUTH_TOKEN</body></html>' };

    const url = `https://api.netlify.com/api/v1/blobs/${siteID}/portals/${encodeURIComponent(slug)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (r.status === 404) return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: notFound() };
    if (!r.ok) throw new Error(`Blob fetch failed: ${r.status}`);

    const html = await r.text();
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, body: html };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: `<html><body style="font-family:sans-serif;padding:40px">Error: ${err.message}</body></html>` };
  }
};

function notFound() {
  return '<!DOCTYPE html><html><head><title>Not Found</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb}p{color:#6b7280;font-size:14px}</style></head><body><p>Please use the link provided by your service team.</p></body></html>';
}
