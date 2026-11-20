import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
}

export class RetailCustomerQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search by name, email or phone',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by franchise ID. Ex: "123e4567-e89b-12d3-a456-426614174000"',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by GSTIN. Ex: "22AAAAA0000A1Z5"',
  })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({
    description: 'Filter by billing street. Ex: "123 Main St"',
  })
  @IsString()
  @IsOptional()
  billingStreet?: string;

  @ApiPropertyOptional({
    description: 'Filter by billing city. Ex: "Mumbai"',
  })
  @IsString()
  @IsOptional()
  billingCity?: string;

  @ApiPropertyOptional({
    description: 'Filter by franchise code. Ex: "FRAN001"',
  })
  @IsString()
  @IsOptional()
  franchiseCode?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
