export function handleRequest(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/api/health' && (request.method === 'GET' || request.method === 'HEAD')) {
    response.writeHead(200);
    response.end(
      request.method === 'HEAD'
        ? undefined
        : JSON.stringify({ status: 'ok', service: 'cfgcn-api', version: '0.1.0' }),
    );
    return;
  }
  response.writeHead(
    pathname === '/api/health' ? 405 : 404,
    pathname === '/api/health' ? { Allow: 'GET, HEAD' } : {},
  );
  response.end(
    JSON.stringify({ error: pathname === '/api/health' ? 'method_not_allowed' : 'not_found' }),
  );
}
