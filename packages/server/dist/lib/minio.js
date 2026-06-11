"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.minioClient = void 0;
exports.ensureBucket = ensureBucket;
exports.uploadBuffer = uploadBuffer;
exports.getPresignedUrl = getPresignedUrl;
const Minio = __importStar(require("minio"));
exports.minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000'),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
});
const BUCKET = process.env.MINIO_BUCKET ?? 'messenger-files';
async function ensureBucket() {
    const exists = await exports.minioClient.bucketExists(BUCKET);
    if (!exists) {
        await exports.minioClient.makeBucket(BUCKET, 'us-east-1');
    }
}
async function uploadBuffer(objectName, buffer, mimeType) {
    await exports.minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
        'Content-Type': mimeType,
    });
    return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${objectName}`;
}
async function getPresignedUrl(objectName, expiry = 3600) {
    return exports.minioClient.presignedGetObject(BUCKET, objectName, expiry);
}
//# sourceMappingURL=minio.js.map