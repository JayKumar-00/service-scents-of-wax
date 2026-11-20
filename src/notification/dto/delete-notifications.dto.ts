import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class DeleteNotificationsDto {
  @ApiProperty({
    description: 'Array of notification IDs to delete',
    type: [String],
    example: ['notification-id-1', 'notification-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
