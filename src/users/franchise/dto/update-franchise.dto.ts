import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { RegisterFranchiseDto } from './register-franchise.dto';

export enum FranchiseGenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NOT_SPECIFIED = 'NOT_SPECIFIED',
}

export class FranchiseProfileUpdateDto extends PartialType(
  RegisterFranchiseDto,
) {
  @ApiPropertyOptional({ example: 'KYC review note' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  kycNote?: string;
}
