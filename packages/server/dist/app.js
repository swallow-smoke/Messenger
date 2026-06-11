"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.app = exports.api = void 0;
require("./lib/env");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = __importDefault(require("./routes/auth"));
const workspaces_1 = __importDefault(require("./routes/workspaces"));
const channels_1 = __importDefault(require("./routes/channels"));
const messages_1 = __importDefault(require("./routes/messages"));
const dm_1 = __importDefault(require("./routes/dm"));
const documents_1 = __importDefault(require("./routes/documents"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const integrations_1 = __importDefault(require("./routes/integrations"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const files_1 = __importDefault(require("./routes/files"));
const link_preview_1 = __importDefault(require("./routes/link-preview"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const socket_1 = require("./socket");
const minio_1 = require("./lib/minio");
const app = (0, express_1.default)();
exports.app = app;
const httpServer = http_1.default.createServer(app);
app.use((0, cors_1.default)({ origin: '*', credentials: true }));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
exports.api = express_1.default.Router();
exports.api.use('/auth', auth_1.default);
exports.api.use('/workspaces', workspaces_1.default);
exports.api.use('/channels', channels_1.default);
exports.api.use('/messages', messages_1.default);
exports.api.use('/dm', dm_1.default);
exports.api.use('/documents', documents_1.default);
exports.api.use('/tasks', tasks_1.default);
exports.api.use('/integrations', integrations_1.default);
exports.api.use('/webhooks', webhooks_1.default);
exports.api.use('/files', files_1.default);
exports.api.use('/link-preview', link_preview_1.default);
exports.api.use('/notifications', notifications_1.default);
app.use('/api/v1', exports.api);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
});
const io = (0, socket_1.initSocket)(httpServer);
exports.io = io;
app.set('io', io);
const PORT = parseInt(process.env.PORT ?? '4000');
async function start() {
    await (0, minio_1.ensureBucket)().catch(console.warn);
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
start().catch(console.error);
//# sourceMappingURL=app.js.map