import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class UpdatePickupDto {
  @ApiProperty({
    description: 'List of Shiprocket Order IDs',
    example: [123456, 789012],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  order_id!: number[];

  @ApiProperty({
    description: 'Pickup location name configured in Shiprocket',
    example: 'Primary Warehouse',
  })
  @IsString()
  @IsNotEmpty()
  pickup_location!: string;

  @ApiPropertyOptional({
    description: 'Pickup location opening time in HH:mm format',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  open_time?: string;

  @ApiPropertyOptional({
    description: 'Pickup location closing time in HH:mm format',
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  close_time?: string;
}
