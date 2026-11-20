import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BannerPlatform,
  BannerPosition,
  BannerRedirectType,
  BannerStatus,
  BannerType,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBannerDto {
  @ApiProperty({ description: 'Banner title' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Optional subtitle for the banner' })
  @IsOptional()
  @IsString()
  subTitle?: string;

  @ApiPropertyOptional({ description: 'Optional description/body copy' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: BannerType, description: 'Domain type for this banner' })
  @IsEnum(BannerType)
  type!: BannerType;

  @ApiProperty({ description: 'Main banner image URL/path' })
  @IsString()
  @MinLength(1)
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Mobile optimized image URL/path' })
  @IsOptional()
  @IsString()
  mobileImageUrl?: string;

  @ApiPropertyOptional({ description: 'CTA button text' })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiProperty({
    enum: BannerRedirectType,
    description: 'Determines which redirect field is required',
  })
  @IsEnum(BannerRedirectType)
  redirectType!: BannerRedirectType;

  @ApiPropertyOptional({
    description: 'Entity id for PRODUCT/BRAND/CATEGORY redirects',
  })
  @IsOptional()
  @IsString()
  redirectId?: string;

  @ApiPropertyOptional({ description: 'Target URL for URL redirect type' })
  @IsOptional()
  @IsString()
  redirectUrl?: string;

  @ApiPropertyOptional({
    description: 'Short code for compact redirection links',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  shortCode?: string;

  @ApiPropertyOptional({
    enum: BannerPlatform,
    default: BannerPlatform.BOTH,
  })
  @IsOptional()
  @IsEnum(BannerPlatform)
  platform?: BannerPlatform = BannerPlatform.BOTH;

  @ApiProperty({ enum: BannerPosition })
  @IsEnum(BannerPosition)
  position!: BannerPosition;

  @ApiPropertyOptional({
    description: 'Lower/higher based on your UI sorting strategy',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number = 0;

  @ApiPropertyOptional({ description: 'Schedule start date/time (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Schedule end date/time (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: BannerStatus, default: BannerStatus.DRAFT })
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus = BannerStatus.DRAFT;

  @ApiPropertyOptional({ description: 'Optional campaign identifier' })
  @IsOptional()
  @IsString()
  campaignId?: string;
}
