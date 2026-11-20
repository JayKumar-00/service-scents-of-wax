import { ApiProperty } from '@nestjs/swagger';
import { FranchiseDocumentKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class FranchiseDocumentDto {
  @ApiProperty({ enum: FranchiseDocumentKind })
  @IsEnum(FranchiseDocumentKind)
  kind!: FranchiseDocumentKind;

  @ApiProperty({ example: 'GST Certificate' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: 'https://cdn.example.com/gst.pdf' })
  // @IsUrl({ require_tld: false })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
