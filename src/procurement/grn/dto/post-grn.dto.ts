import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PostGrnDto {
  @ApiPropertyOptional({
    description: 'Optional reference number or invoice note for posting the GRN',
    example: 'REF-GRN-109238',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}

