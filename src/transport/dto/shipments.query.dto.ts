import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class GetShipmentsQueryDto extends QueryDto {
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
}
