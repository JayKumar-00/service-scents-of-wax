import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/types/jwt-user.type';
import * as path from 'path';
import { CreateMediaItemDto } from 'src/products/media-library/dto/create-media.dto';
import { MediaLibraryService } from 'src/products/media-library/media-library.service';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AwsS3Provider } from './providers/aws-s3.provider';
import { AuditService } from '../audit/audit.service';

type UploadItem = {
  key: string;
  url: string;
};

@Injectable()
export class UploadsService {
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly region: string;

  constructor(
    private readonly provider: AwsS3Provider,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MediaLibraryService))
    private readonly mediaLibraryService: MediaLibraryService,
    private readonly audit: AuditService,
  ) {
    this.bucket = this.config.get<string>(
      'STORAGE_BUCKET_NAME',
      'giftfactorybucket',
    );
    this.publicUrl = this.config.getOrThrow<string>('AWS_PREFIX_URL');
    this.region = this.config.getOrThrow<string>('AWS_REGION');
  }

  private sanitizeFilename(filename: string) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]+/g, '-');
    const safeExt = ext.replace(/[^a-zA-Z0-9.]+/g, '');
    return `${name || 'file'}${safeExt}`.replace(/-+/g, '-');
  }

  private buildKey(prefix: string, file: Express.Multer.File) {
    return `${prefix}__${Date.now()}-${this.sanitizeFilename(file.originalname)}`;
  }

  public getObjectUrl(key: string) {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private async uploadToStorage(
    key: string,
    file: Express.Multer.File,
  ): Promise<UploadItem> {
    await this.provider.uploadFile(
      this.bucket,
      key,
      file.buffer,
      file.mimetype,
    );

    return {
      key,
      url: this.getObjectUrl(key),
    };
  }

  private async deleteFromStorage(key: string): Promise<void> {
    await this.provider.deleteFile(this.bucket, key);
  }

  private async listFromStorage(prefix: string): Promise<string[]> {
    return this.provider.listFiles(this.bucket, prefix);
  }

  private async getPresignedUrl(key: string): Promise<string> {
    // return this.provider.getPresignedUrl(this.bucket, key);
    return this.getObjectUrl(key);
  }

  private async listItems(prefix: string): Promise<Array<UploadItem>> {
    const keys = await this.listFromStorage(prefix);
    const sorted = keys.sort((a, b) => b.localeCompare(a));

    return Promise.all(
      sorted.map(async (key) => ({
        key,
        url: this.getObjectUrl(key),
      })),
    );
  }

  public async uploadScopedFile(prefix: string, file: Express.Multer.File) {
    const key = this.buildKey(prefix, file);
    return this.uploadToStorage(key, file);
  }

  private async uploadExactFile(key: string, file: Express.Multer.File) {
    return this.uploadToStorage(key, file);
  }

  private async replaceScopedFile(
    key: string,
    file: Express.Multer.File,
  ): Promise<UploadItem> {
    await this.uploadToStorage(key, file);
    return {
      key,
      url: await this.getPresignedUrl(key),
    };
  }

  async adminUploadFranchiseDocument(
    franchiseId: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const uploaded = await this.uploadScopedFile(
      `admin-franchise-document-${franchiseId}`,
      file,
    );
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-franchise-document.upload',
        resource: 'Upload',
        resourceId: franchiseId,
        metadata: { key: uploaded.key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async adminListFranchiseDocuments(franchiseId: string) {
    return this.listItems(`admin-franchise-document-${franchiseId}__`);
  }

  async adminGetFranchiseDocument(franchiseId: string, key: string) {
    const prefix = `admin-franchise-document-${franchiseId}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    return {
      key,
      url: await this.getPresignedUrl(key),
    };
  }

  async adminReplaceFranchiseDocument(
    franchiseId: string,
    key: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const prefix = `admin-franchise-document-${franchiseId}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    const uploaded = await this.replaceScopedFile(key, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-franchise-document.replace',
        resource: 'Upload',
        resourceId: franchiseId,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async adminDeleteFranchiseDocument(
    franchiseId: string,
    key: string,
    actor?: { userId?: string; ip?: string },
  ) {
    const prefix = `admin-franchise-document-${franchiseId}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    await this.deleteFromStorage(key);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-franchise-document.delete',
        resource: 'Upload',
        resourceId: franchiseId,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return { ok: true as const, key };
  }

  async adminUploadProductFile(
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const uniqueName = `products/og-${randomBytes(8).toString('hex')}`;
    const key = this.buildKey(uniqueName, file);
    const uploaded = await this.uploadExactFile(key, file);

    const dto: CreateMediaItemDto = {
      url: uploaded.url,
      key: uploaded.key,
      mimeType: file.mimetype,
      size: String(file.size),
    };

    await this.mediaLibraryService.create(
      actor?.userId ? ({ sub: actor.userId } as any) : undefined,
      dto,
      actor?.ip,
    );

    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-product-file.upload',
        resource: 'Upload',
        resourceId: uploaded.key,
        metadata: { mimeType: file.mimetype, size: String(file.size) },
        ip: actor.ip,
      });
    }

    return uploaded;
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    actor?: { userId?: string; ip?: string },
  ) {
    if (!files?.length) throw new BadRequestException('Files required');

    const result = await Promise.all(
      files.map((f) => this.adminUploadProductFile(f, actor)) ?? [],
    );
    return { data: result, message: 'Files uploaded successfully' };
  }

  async adminListProductFiles() {
    return this.listItems(`products/og-`);
  }

  async adminGetProductFile(key: string) {
    const prefix = `products/og-`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    return {
      key,
      url: await this.getPresignedUrl(key),
    };
  }

  async adminReplaceProductFile(
    key: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const prefix = `products/og-`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }

    const uploaded = await this.replaceScopedFile(key, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-product-file.replace',
        resource: 'Upload',
        resourceId: key,
        metadata: { mimeType: file.mimetype, size: String(file.size) },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async adminDeleteProductFile(
    key: string,
    actor?: { userId?: string; ip?: string },
  ) {
    const prefix = `products/og-`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }

    await this.deleteFromStorage(key);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.admin-product-file.delete',
        resource: 'Upload',
        resourceId: key,
        metadata: {},
        ip: actor.ip,
      });
    }
    return { ok: true as const, key };
  }

  async franchiseUploadDocument(
    user: JwtUser,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const uploaded = await this.uploadScopedFile(
      `franchise-document-${user.sub}`,
      file,
    );
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.franchise-document.upload',
        resource: 'Upload',
        resourceId: user.sub,
        metadata: { key: uploaded.key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async franchiseListDocuments(user: JwtUser) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    return this.listItems(`franchise-document-${user.sub}__`);
  }

  async franchiseGetDocument(user: JwtUser, key: string) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const prefix = `franchise-document-${user.sub}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    return {
      key,
      url: await this.getPresignedUrl(key),
    };
  }

  async franchiseReplaceDocument(
    user: JwtUser,
    key: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const prefix = `franchise-document-${user.sub}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    const uploaded = await this.replaceScopedFile(key, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.franchise-document.replace',
        resource: 'Upload',
        resourceId: user.sub,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async franchiseDeleteDocument(
    user: JwtUser,
    key: string,
    actor?: { userId?: string; ip?: string },
  ) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const prefix = `franchise-document-${user.sub}__`;
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    await this.deleteFromStorage(key);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.franchise-document.delete',
        resource: 'Upload',
        resourceId: user.sub,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return { ok: true as const, key };
  }

  async deleteAllWithPrefix(prefix: string): Promise<string[]> {
    const keys = await this.listFromStorage(prefix);
    for (const key of keys) {
      await this.deleteFromStorage(key);
    }
    return keys;
  }

  async adminDeleteAllFranchiseDocuments(franchiseId: string) {
    const prefix = `admin-franchise-document-${franchiseId}__`;
    const deleted = await this.deleteAllWithPrefix(prefix);
    return { ok: true as const, deleted };
  }

  async franchiseDeleteAllDocuments(user: JwtUser) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const prefix = `franchise-document-${user.sub}__`;
    const deleted = await this.deleteAllWithPrefix(prefix);
    return { ok: true as const, deleted };
  }

  // Banner
  async bannerUploadFile(
    prefix: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    const uploaded = await this.uploadScopedFile(prefix, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.banner.upload',
        resource: 'Upload',
        resourceId: prefix,
        metadata: { key: uploaded.key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async bannerFileUrls(prefix: string) {
    // const franchiseId = await this.resolveFranchiseIdForUser(user);
    return this.listItems(`${prefix}__`);
  }

  async bannerReplaceDocument(
    prefix: string,
    key: string,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    if (!key.startsWith(`${prefix}__`)) {
      throw new BadRequestException('Invalid file key');
    }
    const uploaded = await this.replaceScopedFile(key, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.banner.replace',
        resource: 'Upload',
        resourceId: prefix,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async deleteBanner(
    prefix: string,
    key: string,
    actor?: { userId?: string; ip?: string },
  ) {
    if (!key.startsWith(`${prefix}__`)) {
      throw new BadRequestException('Invalid file key');
    }
    await this.deleteFromStorage(key);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.banner.delete',
        resource: 'Upload',
        resourceId: prefix,
        metadata: { key },
        ip: actor.ip,
      });
    }
    return { ok: true as const, key };
  }

  async customerUploadDocument(
    user: JwtUser,
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const uploaded = await this.uploadScopedFile(`avtar-${user.sub}`, file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.customer-avatar.upload',
        resource: 'Upload',
        resourceId: user.sub,
        metadata: { key: uploaded.key },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async uploadReturnFile(
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const uploaded = await this.uploadScopedFile('return', file);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.return-file.upload',
        resource: 'Upload',
        resourceId: uploaded.key,
        metadata: {},
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async uploadProductReviewFile(
    file: Express.Multer.File,
    actor?: { userId?: string; ip?: string },
  ) {
    const uniqueName = `product-reviews/review-${randomBytes(8).toString('hex')}`;
    const key = this.buildKey(uniqueName, file);
    const uploaded = await this.uploadExactFile(key, file);

    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.product-review.upload',
        resource: 'Upload',
        resourceId: uploaded.key,
        metadata: { mimeType: file.mimetype, size: String(file.size) },
        ip: actor.ip,
      });
    }
    return uploaded;
  }

  async listReturnFiles() {
    return this.listItems('return__');
  }

  async getReturnFile(key: string) {
    const prefix = 'return__';
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    return {
      key,
      url: await this.getPresignedUrl(key),
    };
  }

  async deleteReturnFile(
    key: string,
    actor?: { userId?: string; ip?: string },
  ) {
    const prefix = 'return__';
    if (!key.startsWith(prefix)) {
      throw new BadRequestException('Invalid file key');
    }
    await this.deleteFromStorage(key);
    if (actor?.userId) {
      await this.audit.log({
        userId: actor.userId,
        action: 'uploads.return-file.delete',
        resource: 'Upload',
        resourceId: key,
        metadata: {},
        ip: actor.ip,
      });
    }
    return { ok: true as const, key };
  }
}
