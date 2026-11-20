import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditTransactionEnum, DirectionEnum } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import { ReferenceTypeEnum } from '../enums/credit.enum';
import { Type } from 'class-transformer';

export enum SortBy {
  CREATED_AT = 'createdAt',
  AMOUNT = 'amount',
  OWNER = 'franchise.ownerFullName',
  BUSINESS = 'franchise.businessName',
}

export class CreditTransactionQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Search (franchise.ownerFullName, franchise.businessName)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'ID of the franchise to filter transactions',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'ID of the credit account to filter transactions',
  })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Type of credit transaction (e.g., ORDER, ADJUSTMENT)',
    enum: CreditTransactionEnum,
  })
  @IsOptional()
  @IsEnum(CreditTransactionEnum)
  type?: CreditTransactionEnum;

  @ApiPropertyOptional({
    description: 'Minimum transaction amount to filter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum transaction amount to filter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Direction of the transaction (DEBIT or CREDIT)',
    enum: DirectionEnum,
  })
  @IsOptional()
  @IsEnum(DirectionEnum)
  direction?: DirectionEnum;

  @ApiPropertyOptional({
    description:
      'Reference type for the transaction (e.g., ORDER, STOCK_REQUEST)',
    enum: ReferenceTypeEnum,
  })
  @IsOptional()
  @IsEnum(ReferenceTypeEnum)
  referenceType?: ReferenceTypeEnum;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
