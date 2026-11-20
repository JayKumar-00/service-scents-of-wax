import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateQcDto {
  @ApiProperty({
    description: 'The associated Goods Receipt Note (GRN) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  grnId!: string;

  @ApiPropertyOptional({
    description: 'The associated Goods Receipt Note (GRN) Line ID, if specific to a line item',
    example: '660e8400-e29b-41d4-a716-446655441111',
  })
  @IsOptional()
  @IsString()
  grnLineId?: string;

  @ApiPropertyOptional({
    description: 'Any quality control notes or inspection remarks',
    example: 'Passed check, packaging intact, items match invoice specifications.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

