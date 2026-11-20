import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export class PickupQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Search (customer_name, customer_email). Ex: 'CUSTOM`,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
