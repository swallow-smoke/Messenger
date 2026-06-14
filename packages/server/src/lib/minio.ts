import * as Minio from 'minio';

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
});

const BUCKET = process.env.MINIO_BUCKET ?? 'messenger-files';

// Separate client for presigning — uses the public endpoint so the HMAC Host
// header matches what the Electron renderer sends (localhost), not the
// Docker-internal service name (minio). Using minio:9000 for signing but
// localhost:9000 for fetching causes SignatureDoesNotMatch → 403.
function buildPresignClient(): Minio.Client {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return minioClient;
  try {
    const { hostname, port, protocol } = new URL(publicUrl);
    return new Minio.Client({
      endPoint: hostname,
      port: port ? parseInt(port) : protocol === 'https:' ? 443 : 80,
      useSSL: protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
      region: 'us-east-1',
    });
  } catch {
    return minioClient;
  }
}

const presignClient = buildPresignClient();

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
  return presignClient.presignedGetObject(BUCKET, objectName, expiry);
}
