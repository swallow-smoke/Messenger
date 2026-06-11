import './lib/env';
import express, { type Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRouter from './routes/auth';
import workspacesRouter from './routes/workspaces';
import channelsRouter from './routes/channels';
import messagesRouter from './routes/messages';
import dmRouter from './routes/dm';
import documentsRouter from './routes/documents';
import tasksRouter from './routes/tasks';
import usersRouter from './routes/users';
import integrationsRouter from './routes/integrations';
import webhooksRouter from './routes/webhooks';
import filesRouter from './routes/files';
import linkPreviewRouter from './routes/link-preview';
import notificationsRouter from './routes/notifications';
import { initSocket } from './socket';
import { ensureBucket } from './lib/minio';

const app: Express = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export const api = express.Router();
api.use('/auth', authRouter);
api.use('/workspaces', workspacesRouter);
api.use('/channels', channelsRouter);
api.use('/messages', messagesRouter);
api.use('/dm', dmRouter);
api.use('/documents', documentsRouter);
api.use('/tasks', tasksRouter);
api.use('/users', usersRouter);
api.use('/integrations', integrationsRouter);
api.use('/webhooks', webhooksRouter);
api.use('/files', filesRouter);
api.use('/link-preview', linkPreviewRouter);
api.use('/notifications', notificationsRouter);

app.use('/api/v1', api);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'GameDev Messenger Server is running' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

const io = initSocket(httpServer);
app.set('io', io);

const PORT = parseInt(process.env.PORT ?? '4000');

async function start(): Promise<void> {
  await ensureBucket().catch(console.warn);
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);

export { app, io };
