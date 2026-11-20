import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateExchangeMemoDto {
  @ApiProperty({ description: 'Optional remarks/notes', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}
