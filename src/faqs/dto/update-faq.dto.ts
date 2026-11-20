import { OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BooleanString } from './faq-query.dto';
import { CreateFaqDto } from './create-faq.dto';

export class UpdateFaqDto extends OmitType(CreateFaqDto, [
  'isVisible',
] as const) {
  @ApiPropertyOptional({
    description: 'Visibility state to apply',
    enum: BooleanString,
  })
  @IsOptional()
  @IsEnum(BooleanString)
  visibility?: BooleanString;
}
