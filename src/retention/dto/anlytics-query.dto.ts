import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class ProductAnalyticsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Enter search term (ProductName)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Enter category id',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CategoryAnalyticsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Enter search term (CategoryName)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Enter category id',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Enter user id',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UserAnalyticsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Enter user id',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Enter customer id',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Enter IP address',
  })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({
    description: 'Enter device token',
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @ApiPropertyOptional({
    description: 'Enter search term (UserName, CategoryName)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Enter category id',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class BrandAnalyticsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Enter search term (BrandName)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Enter brand id',
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Enter user id',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
