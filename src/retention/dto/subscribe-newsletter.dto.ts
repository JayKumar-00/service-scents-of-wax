import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsletterSource } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class SubscribeNewsletterDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    enum: NewsletterSource,
    example: NewsletterSource.FOOTER,
    default: NewsletterSource.FOOTER,
    description: 'Where the subscription originated',
  })
  @IsEnum(NewsletterSource)
  @IsOptional()
  source: NewsletterSource = NewsletterSource.FOOTER;
}
