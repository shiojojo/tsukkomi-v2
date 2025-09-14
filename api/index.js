import { Readable } from 'node:stream';

export default async function (req, res) {
  let handler;
  try {
    const built = await import('../build/server/index.js');
    handler = built?.default;
  } catch (e) {
    console.error('Failed to import built server:', e);
  }

  if (!handler) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Server build not found. Run `npm run build` before deploying.');
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? null : req,
    });

    const response = await handler(request, 200, new Headers(), { isSpaMode: false }, {});

    res.statusCode = response.status;
    for (const [k, v] of response.headers) res.setHeader(k, v);

    if (response.body) {
      // Convert Response.body (a WHATWG ReadableStream) into Node Readable
      const reader = response.body.getReader();
      const nodeStream = new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(Buffer.from(value));
            }
          } catch (err) {
            this.destroy(err);
          }
        }
      });

      nodeStream.pipe(res);
    } else {
      const text = await response.text();
      res.end(text);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }
}
