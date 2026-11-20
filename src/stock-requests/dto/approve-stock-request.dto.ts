import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class ApproveStockRequestDto {
  /** If omitted, approves the full requested quantity */
  @ApiPropertyOptional({
    description:
      'Approved quantity (optional, defaults to full requested quantity)',
    example: 5,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  approvedQuantity!: number;
}
