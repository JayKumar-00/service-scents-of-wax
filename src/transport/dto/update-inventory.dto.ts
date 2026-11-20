import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

export enum InventoryAction {
  ADD = 'add',
  REPLACE = 'replace',
  REMOVE = 'remove',
}

export class UpdateInventoryDto {
  @ApiProperty({
    example: 10,
    description: 'Available quantity of the product',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  quantity!: number;

  @ApiProperty({
    enum: InventoryAction,
    example: InventoryAction.ADD,
    description: 'Available quantity of the product',
  })
  @IsEnum(InventoryAction)
  @IsNotEmpty()
  action!: number;
}
