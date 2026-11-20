import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryDto } from 'src/common/dto/query.dto';

export class GetOrdersQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search for AWB or by Channel order_id (order id specified by you). Ex: 'AWB123' or 'CH123'`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: `Search Orders on the basis of pickup location. Ex: 'Delhi'`,
  })
  @IsOptional()
  @IsString()
  pickup_location?: string;

  @ApiPropertyOptional({
    description: 'Channel ID Returned in Get Integrated Channels API. Ex 123',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  channel_id?: number;

  @ApiPropertyOptional({
    description: 'Filter by FBS orders (1 for FBS, 0 for non-FBS)',
  })
  @Type(() => Number)
  @IsEnum([0, 1])
  @IsOptional()
  fbs?: number;

  @ApiPropertyOptional({
    description:
      'Filter by FBS orders (1 for all FBS orders, 0 for non-FBS or mixed)',
  })
  @Type(() => Number)
  @IsEnum([0, 1])
  @IsEnum([0, 1])
  @IsOptional()
  fbs_all_orders?: number;

  @ApiPropertyOptional({
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Filter value',
  })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({
    description: 'Field to filter by',
  })
  @IsOptional()
  @IsString()
  filter_by?: string;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // page?: number = 1;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // per_page?: number = 20;

  // // Shiprocket supported filters
  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsString()
  // order_id?: string;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsString()
  // status?: string;
}
