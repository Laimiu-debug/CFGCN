import { createServer } from 'node:http';
import { handleRequest } from './app.mjs';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be between 1 and 65535');
const server = createServer(handleRequest);
server.listen(port, '127.0.0.1', () =>
  console.log(`CFGCN API http://127.0.0.1:${port}/api/health`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
