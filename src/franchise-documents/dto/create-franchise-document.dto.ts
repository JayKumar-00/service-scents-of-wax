import { IsEnum, IsString, IsUrl, MinLength } from 'class-validator';
import { FranchiseDocumentKind } from '@prisma/client';

export class CreateFranchiseDocumentDto {
  @IsEnum(FranchiseDocumentKind)
  kind!: FranchiseDocumentKind;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsUrl({ require_tld: false })
  fileUrl!: string;
}
