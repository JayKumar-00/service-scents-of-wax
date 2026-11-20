import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateAttributeDto } from './create-attribute.dto';
import { IsNotEmpty } from 'class-validator';

export enum AttributeType {
  NAME = 'name',
  VALUE = 'value',
}

/**
 * DTO for updating an existing product attribute.
 * Inherits all fields from CreateAttributeDto but makes them optional.
 * @class UpdateAttributeDto
 * @extends PartialType(CreateAttributeDto)
 */
export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}

export class UpdateAttributeValueDto {
  @ApiProperty({
    example: 'Red',
    description: 'New title for the attribute value',
  })
  @IsNotEmpty()
  title!: string;
}
