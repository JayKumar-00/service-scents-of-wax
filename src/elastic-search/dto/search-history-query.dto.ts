import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Customer ID (optional for anonymous searches)',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description:
      'Limit number of history entries to return (for list endpoint)',
    example: 3,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  limit?: number;
}
