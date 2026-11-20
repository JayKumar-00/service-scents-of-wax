import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { toArray } from 'src/common/utils/transform-cutome.util';

export class BulkApproveStockRequestsDto {
  @ApiProperty({
    description: 'Array of stock request IDs to approve',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
