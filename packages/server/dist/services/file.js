"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImageThumbnail = createImageThumbnail;
const sharp_1 = __importDefault(require("sharp"));
const minio_1 = require("../lib/minio");
async function createImageThumbnail(buffer, objectName) {
    const thumb = await (0, sharp_1.default)(buffer).resize(400, 400, { fit: 'cover' }).png().toBuffer();
    return (0, minio_1.uploadBuffer)(objectName, thumb, 'image/png');
}
//# sourceMappingURL=file.js.map