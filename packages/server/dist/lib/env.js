"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const envPath = findEnvPath(__dirname);
if (envPath) {
    for (const line of fs_1.default.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1)
            continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] ??= value;
    }
}
function findEnvPath(startDir) {
    let currentDir = startDir;
    for (let depth = 0; depth < 8; depth += 1) {
        const candidate = path_1.default.join(currentDir, '.env');
        if (fs_1.default.existsSync(candidate))
            return candidate;
        const parentDir = path_1.default.dirname(currentDir);
        if (parentDir === currentDir)
            break;
        currentDir = parentDir;
    }
    return null;
}
//# sourceMappingURL=env.js.map