import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListCourierType } from '../enums/shiprocket.enum';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class ListCouriersQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Type of courier list to retrieve',
    enum: ListCourierType,
    example: ListCourierType.ALL,
  })
  @IsEnum(ListCourierType)
  type!: ListCourierType;

  @ApiPropertyOptional({
    description: `Search (master_company). Ex: 'Wow Express'`,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
