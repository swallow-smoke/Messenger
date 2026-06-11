import sharp from 'sharp';
import { uploadBuffer } from '../lib/minio';

export async function createImageThumbnail(buffer: Buffer, objectName: string): Promise<string> {
  const thumb = await sharp(buffer).resize(400, 400, { fit: 'cover' }).png().toBuffer();
  return uploadBuffer(objectName, thumb, 'image/png');
}
