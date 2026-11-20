import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadDocumentFileDto {
  @ApiProperty({
    description: 'File to upload',
    type: 'string',
    format: 'binary',
  })
  file?: Express.Multer.File;

  @ApiProperty({
    description: 'Document ID associated with the file',
    example: '507f1f77bcf86cd799439011',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}

export class UploadProductFileDto {
  @ApiProperty({
    description: 'File to upload',
    type: 'string',
    format: 'binary',
  })
  file?: Express.Multer.File;

  @ApiProperty({
    description: 'Product ID associated with the file',
    example: '507f1f77bcf86cd799439011',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

export class UploadBinaryFileDto {
  @ApiProperty({
    description: 'File to upload',
    type: 'string',
    format: 'binary',
  })
  file!: Express.Multer.File;
}

export class UploadResponseDto {
  @ApiProperty({
    description: 'File URL',
    example:
      'http://localhost:9000/products/product-507f1f77bcf86cd799439011.jpg',
  })
  url?: string;

  @ApiProperty({
    description: 'File key in storage',
    example: 'product-507f1f77bcf86cd799439011.jpg',
  })
  key?: string;

  @ApiProperty({
    description: 'Storage provider used',
    example: 'minio',
  })
  provider?: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2026-04-19T10:30:00Z',
  })
  uploadedAt?: string;
}
