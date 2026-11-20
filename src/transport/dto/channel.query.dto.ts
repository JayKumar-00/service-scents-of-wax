import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryDto } from 'src/common/dto/query.dto';

export class ChannelQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search (name). Ex: 'CUSTOM`,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
