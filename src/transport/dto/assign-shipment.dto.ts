import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignShipmentDto {
  @ApiProperty({
    example: '16016920',
    description: 'The shipment id of the order you want to create the AWB for.',
  })
  @IsNotEmpty()
  shipment_id!: string;

  @ApiProperty({
    example: '10',
    description:
      'The courier id of the courier service you want to select. The default courier is selected in case no id is specified.',
  })
  @IsOptional()
  courier_id!: string;

  @ApiProperty({
    example: 'reassign',
    description:
      'Use this to change the courier of a shipment. Value: reassign. Note that this can be done only once in 24 hours.',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
