import { ApiPropertyOptional } from '@nestjs/swagger';
import { PanelType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class ThemeQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Filter themes by panel type (e.g., 'admin', 'franchise')`,
    enum: PanelType,
  })
  @IsEnum(PanelType)
  @IsOptional()
  panelType?: string;
}
