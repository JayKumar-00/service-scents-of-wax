export interface IStorageProvider {
  uploadFile(
    bucket: string,
    key: string,
    file: Buffer,
    mimetype: string,
  ): Promise<{ url: string; key: string }>;

  deleteFile(bucket: string, key: string): Promise<void>;

  getFile(bucket: string, key: string): Promise<Buffer>;

  listFiles(bucket: string, prefix?: string): Promise<string[]>;

  getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn?: number,
  ): Promise<string>;
}
