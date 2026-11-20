import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWebThemeDto {
  @ApiPropertyOptional({ example: 'Gift Factory' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ example: 'Inter, sans-serif' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#161615' })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ example: '#cc176b' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  primaryForeground?: string;

  @ApiPropertyOptional({ example: '#62182d' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  secondaryForeground?: string;

  @ApiPropertyOptional({ example: '#e0e0e0' })
  @IsOptional()
  @IsString()
  borderColor?: string;

  @ApiPropertyOptional({ example: '#cc176b' })
  @IsOptional()
  @IsString()
  headerPromoBg?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  headerPromoText?: string;

  @ApiPropertyOptional({ example: '#fde7f3' })
  @IsOptional()
  @IsString()
  headerCategoryPillBg?: string;

  @ApiPropertyOptional({ example: '#cc176b' })
  @IsOptional()
  @IsString()
  headerCategoryPillText?: string;

  @ApiPropertyOptional({ example: '#050b18' })
  @IsOptional()
  @IsString()
  footerBg?: string;

  @ApiPropertyOptional({ example: '#cbd5e1' })
  @IsOptional()
  @IsString()
  footerText?: string;

  @ApiPropertyOptional({ example: '#0f172a' })
  @IsOptional()
  @IsString()
  footerBorder?: string;

  @ApiPropertyOptional({ example: '#cc176b' })
  @IsOptional()
  @IsString()
  cartBadgeBg?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  cartBadgeText?: string;
}
