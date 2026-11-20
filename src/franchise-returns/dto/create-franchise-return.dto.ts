import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFranchiseReturnDto {
  @ApiPropertyOptional({
    description: 'Associated Order ID (if applicable)',
    example: 'order_12345',
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Reason for return',
    example: 'Defective item',
  })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Whether the return is a refund request',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    ['true', '1', 1].includes(value)
      ? true
      : ['false', '0', 0].includes(value)
        ? false
        : value,
  )
  @IsBoolean()
  refundRequested?: boolean;
}
