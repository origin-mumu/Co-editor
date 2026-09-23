import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WSServer } from './wsServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../../data/snapshots');

console.log('--------------------------------------------------');
console.log('🚀 Co-editor WebSocket API Server');
console.log('--------------------------------------------------');

const server = new WSServer(PORT, DATA_DIR);

process.on('SIGINT', async () => {
  console.log('\n[SERVER] Gracefully shutting down...');
  await server.close();
  process.exit(0);
});
