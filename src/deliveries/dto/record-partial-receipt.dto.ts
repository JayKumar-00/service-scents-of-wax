import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecordPartialReceiptDto {
  @ApiProperty({
    description: 'The quantity of items received in this partial receipt.',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'An optional note providing additional information about the partial receipt.',
    example: 'Received 10 items, 5 are damaged.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  /** When true, marks inbound discrepancy as REPORTED (e.g. short against ASN / expected). */
  @ApiPropertyOptional({
    description:
      'When true, marks inbound discrepancy as REPORTED (e.g. short against ASN / expected).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  reportDiscrepancy?: boolean;
}
