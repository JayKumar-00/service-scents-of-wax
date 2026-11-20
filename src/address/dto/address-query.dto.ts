import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class AddressQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by customer ID',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by city',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by country',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by default-address status',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? 'true' : value === 'false' ? 'false' : undefined,
  )
  @IsString()
  isDefault?: string;

  @ApiPropertyOptional({
    description: 'Search by full name or postal code',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
