import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'electronics-001' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ example: 'cmkduheufh' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ example: '1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
