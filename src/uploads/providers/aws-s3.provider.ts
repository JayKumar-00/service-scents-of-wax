import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AwsS3Provider {
  private readonly s3Client: S3Client;

  constructor(private readonly config: ConfigService) {
    const AWS_ACCESS_KEY = this.config.getOrThrow<string>('AWS_ACCESS_KEY');
    const AWS_SECRET_KEY = this.config.getOrThrow<string>('AWS_SECRET_KEY');
    const AWS_REGION = this.config.getOrThrow<string>('AWS_REGION');

    this.s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
    });
  }

  async uploadFile(
    bucket: string,
    key: string,
    file: Buffer,
    mimetype: string,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: mimetype,
      }),
    );
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    const response = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      }),
    );

    return (response.Contents || [])
      .map((item) => item.Key)
      .filter((key): key is string => !!key);
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 60 * 60,
  ): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  }
}
