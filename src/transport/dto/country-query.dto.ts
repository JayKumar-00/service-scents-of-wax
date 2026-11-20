import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryDto } from 'src/common/dto/query.dto';

export class CountryQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search (name). Ex: 'India`,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;
}
