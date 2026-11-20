import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class AllNdrQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search (awb). Ex: 224477`,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
