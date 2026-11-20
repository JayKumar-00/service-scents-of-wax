import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum OrderType {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryDto {
  @ApiPropertyOptional({
    description: `From date (ISO), Ex: '2026-12-11'`,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: `Last date (ISO), Ex: '2026-12-11'`,
  })
  @IsOptional()
  @IsDateString()
  lastDate?: string;

  @ApiPropertyOptional({
    description: `Sort order, Ex: 'asc' | 'desc'`,
    enum: OrderType,
    default: OrderType.DESC,
  })
  @IsOptional()
  @IsEnum(OrderType)
  order?: OrderType = OrderType.DESC;

  @ApiPropertyOptional({
    description: `Page number, Ex: 1`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page, Ex: 10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by return number, Ex: RET-CS-...',
  })
  @IsOptional()
  @IsString()
  returnNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by order number, Ex: GF-1234...',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;
}
