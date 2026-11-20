import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  TOTAL_CREDIT = 'totalCredit',
  USED_CREDIT = 'usedCredit',
  AVAILABLE_CREDIT = 'availableCredit',
  STATUS = 'status',
  OWNER = 'franchise.ownerFullName',
  BUSINESS = 'franchise.businessName',
}

export class CreditSummaryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search (franchise.ownerFullName, franchise.businessName)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Franchise ID to filter credit summary' })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'Minimum credit amount to filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minCredit?: number;

  @ApiPropertyOptional({ description: 'Maximum credit amount to filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxCredit?: number;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
