import * as Minio from 'minio';

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
});

const BUCKET = process.env.MINIO_BUCKET ?? 'messenger-files';

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1');
  }
}

export async function uploadBuffer(
  objectName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': mimeType,
  });
  return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${objectName}`;
}

export async function getPresignedUrl(objectName: string, expiry = 3600): Promise<string> {
  const url = await minioClient.presignedGetObject(BUCKET, objectName, expiry);
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return url;
  try {
    const parsed = new URL(url);
    const pub = new URL(publicUrl);
    parsed.protocol = pub.protocol;
    parsed.hostname = pub.hostname;
    parsed.port = pub.port;
    return parsed.toString();
  } catch {
    return url;
  }
}
