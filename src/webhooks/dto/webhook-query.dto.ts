import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BooleanEnum } from 'src/app-role/dto/update-app-role.dto';
import { QueryDto } from 'src/common/dto/query.dto';

export class WebhookQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Search by endpoint name or description (Label, url, events or secret)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    enum: BooleanEnum,
  })
  @IsEnum(BooleanEnum)
  @IsOptional()
  active?: BooleanEnum;
}
