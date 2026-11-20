import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
}

export class AllocationWithoutFilterQueryDto {
  @ApiPropertyOptional({
    description: 'Product ID to get allocation for',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description:
      "Franchise ID to get allocation for (optional, defaults to user's franchise if not provided)",
  })
  @IsString()
  @IsNotEmpty()
  franchiseId!: string;
}

export class AllocationQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Product ID to get allocation for',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description:
      "Franchise ID to get allocation for (optional, defaults to user's franchise if not provided)",
  })
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @ApiPropertyOptional({
    description: `Sort by field`,
    enum: SortBy,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;
}
