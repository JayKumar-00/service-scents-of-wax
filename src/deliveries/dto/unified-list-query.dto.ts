import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum UnifiedTypeEnum {
  ONLINE_ORDER = 'ONLINE_ORDER',
  STOCK_REQUEST = 'STOCK_REQUEST',
}

export class UnifiedListQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search by order number, invoice number, franchise name/code, customer name/email, or product name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by type (ONLINE_ORDER or STOCK_REQUEST)',
    enum: UnifiedTypeEnum,
  })
  @IsEnum(UnifiedTypeEnum)
  @IsOptional()
  type?: UnifiedTypeEnum;

  @ApiPropertyOptional({
    description: 'Filter by status (OrderStatus or StockRequestStatus value)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by franchise ID',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;
}
