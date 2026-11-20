import { PartialType } from '@nestjs/swagger';
import { CreateVariantDto } from './create-product-variant.dto';

export class UpdateProductVariantDto extends PartialType(CreateVariantDto) {}
