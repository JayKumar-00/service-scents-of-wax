import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QueryDto } from 'src/common/dto/query.dto';

export enum CustomerType {
  ONLINE_CUSTOMER = 'online_customer',
  RETAIL_CUSTOMER = 'retail_customer',
}

export class CustomerQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: `Customer type, Ex: 'online_customer' | 'retail_customer'`,
    enum: CustomerType,
  })
  @IsEnum(CustomerType)
  @IsOptional()
  customerType?: CustomerType;

  @ApiPropertyOptional({
    description: `Search by name, email or phone, Ex: 'john', 'user@gmail.com'`,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
