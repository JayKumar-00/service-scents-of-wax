import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';
import { OrderSettlementStatus, SettlementType } from '@prisma/client';

export class SettlementQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter settlements by status',
    enum: OrderSettlementStatus,
  })
  @IsEnum(OrderSettlementStatus)
  @IsOptional()
  status?: OrderSettlementStatus;

  @ApiPropertyOptional({
    description: 'Filter settlements by type',
    enum: SettlementType,
  })
  @IsEnum(SettlementType)
  @IsOptional()
  type?: SettlementType;

  @ApiPropertyOptional({
    description: 'Filter settlements by franchise ID',
  })
  @IsString()
  @IsOptional()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: 'Filter settlements by affiliate customer ID',
  })
  @IsString()
  @IsOptional()
  affiliateCustomerId?: string;

  @ApiPropertyOptional({
    description: 'Search string (searches order number, franchise code/name, customer name/email, affiliate name)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
