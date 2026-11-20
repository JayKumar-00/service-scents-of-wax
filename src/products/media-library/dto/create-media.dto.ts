import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMediaItemDto {
  @ApiProperty({
    description: 'Public URL to the media file',
    example: '/uploads/my-image.jpg',
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiProperty({
    description: 'Storage key or filename for the media',
    example: 'my-image.jpg',
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
  })
  @IsString()
  mimeType!: string;

  @ApiProperty({
    description: 'File size as string (e.g., in bytes)',
    example: '102400',
  })
  @IsString()
  size!: string;

  @ApiPropertyOptional({ description: 'Tag filter, Ex: nature, landscape' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tag?: string;
}
