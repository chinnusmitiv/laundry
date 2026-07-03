import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { db, initSchema } from './db.js';
import { registerRoutes } from './routes.js';
import { registerAuthRoutes } from './auth.js';
import { runSeed } from './seed.js';

initSchema();

// Auto-seed demo data on an empty database — covers hosts with no persistent
// disk (e.g. Render free tier), where every deploy/restart wipes the DB.
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  console.log('⚠  Empty database — seeding demo data...');
  runSeed();
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  // clients join rooms to receive scoped realtime updates
  socket.on('join', ({ userId, role, orderId }) => {
    if (userId) socket.join(`user:${userId}`);
    if (role) socket.join(`role:${role}`);
    if (orderId) socket.join(`order:${orderId}`);
  });
  socket.on('watch:order', (orderId) => socket.join(`order:${orderId}`));
  socket.on('unwatch:order', (orderId) => socket.leave(`order:${orderId}`));
  socket.on('watch:thread', (threadId) => socket.join(`thread:${threadId}`));
  socket.on('unwatch:thread', (threadId) => socket.leave(`thread:${threadId}`));
});

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

registerAuthRoutes(app, io);
registerRoutes(app, io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  const n = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  console.log(`\n🟢 ChaseLaundry API on http://localhost:${PORT}  (${n} orders in db)`);
  if (n === 0) console.log('   ⚠  No data — run `npm run seed` from the repo root.');
});
