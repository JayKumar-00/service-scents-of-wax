import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for a single attribute value
 * @class AttributeValueDto
 */
class AttributeValueDto {
  /**
   * Display name of the attribute value
   * @example 'Red'
   */
  @ApiProperty({
    example: 'Red',
    description: 'Display name of the attribute value',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;
}

/**
 * DTO for creating a product attribute
 * @class CreateAttributeDto
 */
export class CreateAttributeDto {
  /**
   * Name of the attribute, e.g., Color, Size, Material
   * @example 'Color'
   */
  @ApiProperty({
    example: 'Color',
    description: 'Attribute title (e.g. Color, Size, Material)',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  /**
   * List of possible values for this attribute
   * @example [
   *   { title: 'Red' },
   *   { title: 'Black' },
   *   { title: 'Green' },
   *   { title: 'Blue' }
   * ]
   */
  @ApiProperty({
    type: [AttributeValueDto],
    description: 'List of possible values for this attribute',
    example: [
      { title: 'Red' },
      { title: 'Black' },
      { title: 'Green' },
      { title: 'Blue' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  values!: AttributeValueDto[];
}
