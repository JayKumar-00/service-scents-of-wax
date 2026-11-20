import { IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'Cart item ID' })
  @IsString()
  itemId!: string;

  @ApiProperty({ description: 'New quantity', minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class RemoveCartItemDto {
  @ApiProperty({ description: 'Cart item ID to remove' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;
}
