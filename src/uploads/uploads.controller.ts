import {
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtUser } from '../auth/types/jwt-user.type';
import { multerOptions } from './utils/multer.util';
import { UploadBinaryFileDto } from './dto/upload-file.dto';
import { UploadsService } from './uploads.service';
import { ISuccessResponse } from 'src/common/interceptors/envelope.interface';

@ApiTags('Uploads (Source of Truth from Aws S3)')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('admin/franchise-document/:franchiseId')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upload admin franchise document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @ApiParam({ name: 'franchiseId', example: 'cuid_here' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadAdminFranchiseDocument(
    @Param('franchiseId') franchiseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminUploadFranchiseDocument(franchiseId, file, {
      userId: user.sub,
      ip,
    });
  }

  @Get('admin/franchise-document/:franchiseId')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List admin franchise documents' })
  @ApiParam({ name: 'franchiseId', example: 'cuid_here' })
  listAdminFranchiseDocuments(@Param('franchiseId') franchiseId: string) {
    return this.uploadsService.adminListFranchiseDocuments(franchiseId);
  }

  @Get('admin/franchise-document/:franchiseId/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get admin franchise document' })
  @ApiParam({ name: 'franchiseId', example: 'cuid_here' })
  @ApiParam({
    name: 'key',
    example: 'admin-franchise-document-cuid__123-file.pdf',
  })
  getAdminFranchiseDocument(
    @Param('franchiseId') franchiseId: string,
    @Param('key') key: string,
  ) {
    return this.uploadsService.adminGetFranchiseDocument(franchiseId, key);
  }

  @Patch('admin/franchise-document/:franchiseId/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Replace admin franchise document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @ApiParam({ name: 'franchiseId', example: 'cuid_here' })
  @ApiParam({
    name: 'key',
    example: 'admin-franchise-document-cuid__123-file.pdf',
  })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  replaceAdminFranchiseDocument(
    @Param('franchiseId') franchiseId: string,
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminReplaceFranchiseDocument(
      franchiseId,
      key,
      file,
      { userId: user.sub, ip },
    );
  }

  @Delete('admin/franchise-document/:franchiseId/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Delete admin franchise document' })
  @ApiParam({ name: 'franchiseId', example: 'cuid_here' })
  @ApiParam({
    name: 'key',
    example: 'admin-franchise-document-cuid__123-file.pdf',
  })
  deleteAdminFranchiseDocument(
    @Param('franchiseId') franchiseId: string,
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminDeleteFranchiseDocument(franchiseId, key, {
      userId: user.sub,
      ip,
    });
  }

  @Post('admin/product')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upload admin product file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadAdminProductFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminUploadProductFile(file, {
      userId: user.sub,
      ip,
    });
  }

  @Post('/upload-multiple-files')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'To upload bulk images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<object[]>> {
    return this.uploadsService.uploadMultipleFiles(files, {
      userId: user.sub,
      ip,
    });
  }

  @Get('admin/product')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List admin product files' })
  listAdminProductFiles() {
    return this.uploadsService.adminListProductFiles();
  }

  @Get('admin/product/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get admin product file' })
  @ApiParam({ name: 'key', example: 'admin-product-cuid__123-file.jpg' })
  getAdminProductFile(@Param('key') key: string) {
    return this.uploadsService.adminGetProductFile(key);
  }

  @Patch('admin/product/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Replace admin product file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @ApiParam({ name: 'key', example: 'admin-product-cuid__123-file.jpg' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  replaceAdminProductFile(
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminReplaceProductFile(key, file, {
      userId: user.sub,
      ip,
    });
  }

  @Delete('admin/product/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Delete admin product file' })
  @ApiParam({ name: 'key', example: 'admin-product-cuid__123-file.jpg' })
  deleteAdminProductFile(
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.adminDeleteProductFile(key, {
      userId: user.sub,
      ip,
    });
  }

  @Post('franchise/document')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Upload franchise document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadFranchiseDocument(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.uploadsService.franchiseUploadDocument(user, file, {
      userId: user.sub,
      ip,
    });
  }

  @Get('franchise/document')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'List franchise documents' })
  listFranchiseDocuments(@CurrentUser() user: JwtUser) {
    return this.uploadsService.franchiseListDocuments(user);
  }

  @Get('franchise/document/:key')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Get franchise document' })
  @ApiParam({ name: 'key', example: 'franchise-document-cuid__123-file.pdf' })
  getFranchiseDocument(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
  ) {
    return this.uploadsService.franchiseGetDocument(user, key);
  }

  @Patch('franchise/document/:key')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Replace franchise document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @ApiParam({ name: 'key', example: 'franchise-document-cuid__123-file.pdf' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  replaceFranchiseDocument(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.uploadsService.franchiseReplaceDocument(user, key, file, {
      userId: user.sub,
      ip,
    });
  }

  @Delete('franchise/document/:key')
  @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Delete franchise document' })
  @ApiParam({ name: 'key', example: 'franchise-document-cuid__123-file.pdf' })
  deleteFranchiseDocument(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Ip() ip: string,
  ) {
    return this.uploadsService.franchiseDeleteDocument(user, key, {
      userId: user.sub,
      ip,
    });
  }

  // Banner Uploads
  @Post('banner')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upload Banner (Super Admin, AdminStaff)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.bannerUploadFile('banner', file, {
      userId: user.sub,
      ip,
    });
  }

  @Get('banner-list')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List banner files' })
  listBanners() {
    return this.uploadsService.bannerFileUrls('banner');
  }

  @Get('banner/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get banner file' })
  @ApiParam({ name: 'key', example: 'banner-file.pdf' })
  getBannerFileUrl(@CurrentUser() user: JwtUser, @Param('key') key: string) {
    return this.uploadsService.franchiseGetDocument(user, key);
  }

  @Patch('banner/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Replace banner' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @ApiParam({ name: 'key', example: 'banner-file.pdf' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  replaceBannerFile(
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.bannerReplaceDocument('banner', key, file, {
      userId: user.sub,
      ip,
    });
  }

  @Delete('banner/document/:key')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Delete banner file' })
  @ApiParam({ name: 'key', example: 'banner__123-file.pdf' })
  deleteBanner(
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.deleteBanner('banner', key, {
      userId: user.sub,
      ip,
    });
  }

  @Post('customer/avtar')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Upload customer avtar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadCustomerAvtar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.uploadsService.customerUploadDocument(user, file, {
      userId: user.sub,
      ip,
    });
  }

  // Return Document Uploads
  @Post('return')
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  @ApiOperation({ summary: 'Upload return document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadReturnFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.uploadReturnFile(file, { userId: user.sub, ip });
  }

  // Product Review Uploads
  @Post('product-review')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Upload product review media (image/video)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBinaryFileDto })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadProductReviewFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.uploadProductReviewFile(file, {
      userId: user.sub,
      ip,
    });
  }

  @Get('return')
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  @ApiOperation({ summary: 'List return files' })
  listReturnFiles() {
    return this.uploadsService.listReturnFiles();
  }

  @Get('return/:key')
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get return file by key' })
  @ApiParam({ name: 'key', example: 'return__123-file.pdf' })
  getReturnFile(@Param('key') key: string) {
    return this.uploadsService.getReturnFile(key);
  }

  @Delete('return/:key')
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  @ApiOperation({ summary: 'Delete return file by key' })
  @ApiParam({ name: 'key', example: 'return__123-file.pdf' })
  deleteReturnFile(
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.uploadsService.deleteReturnFile(key, { userId: user.sub, ip });
  }
}
