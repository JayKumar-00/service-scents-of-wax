import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID of the subscription plan',
    example: 'plan_123456789',
  })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiProperty({
    description: 'ID of the customer subscribing to the plan',
    example: 'cust_123456789',
  })
  @IsString()
  @IsNotEmpty()
  customerId!: string;
}
