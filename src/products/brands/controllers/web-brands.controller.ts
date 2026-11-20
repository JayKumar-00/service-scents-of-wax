import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { BrandsService } from '../brands.service';
import { BrandQueryDto } from '../dto/brand-query.dto';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';

@Public()
@ApiTags('Brands <- Web (Public)')
@Controller('web-brands')
export class WebBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get('brands')
  @ApiOperation({ summary: 'List brands (public)' })
  list(@Query() query: BrandQueryDto): Promise<ISuccessResponse<any[], IMeta>> {
    return this.brands.list(query) as any;
  }

  @Get('brands/:slug')
  @ApiOperation({ summary: 'Get brand by slug (public)' })
  getBySlug(@Param('slug') slug: string) {
    return this.brands.findBySlug(slug);
  }
}
