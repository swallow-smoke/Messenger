"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const minio_1 = require("../lib/minio");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const GAME_ASSET_EXTS = new Set(['.glb', '.gltf', '.fbx']);
router.post('/upload', auth_1.requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file' });
            return;
        }
        const ext = path_1.default.extname(req.file.originalname).toLowerCase();
        const id = crypto_1.default.randomUUID();
        const objectName = `${id}${ext}`;
        const fileUrl = await (0, minio_1.uploadBuffer)(objectName, req.file.buffer, req.file.mimetype);
        let thumbnailUrl = null;
        if (IMAGE_TYPES.has(req.file.mimetype)) {
            const thumb = await (0, sharp_1.default)(req.file.buffer)
                .resize(400, 400, { fit: 'cover' })
                .png()
                .toBuffer();
            const thumbName = `${id}_thumb.png`;
            thumbnailUrl = await (0, minio_1.uploadBuffer)(thumbName, thumb, 'image/png');
        }
        else if (GAME_ASSET_EXTS.has(ext)) {
            thumbnailUrl = null;
        }
        res.json({
            url: fileUrl,
            thumbnailUrl,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
        });
    }
    catch {
        res.status(500).json({ error: 'Upload failed' });
    }
});
exports.default = router;
//# sourceMappingURL=files.js.map