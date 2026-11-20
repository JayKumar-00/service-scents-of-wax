import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Products <- Admin')
@Controller('products')
export class ProductsController {
  /*
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(24), ParseIntPipe) pageSize: number,
    @Query('category') categorySlug?: string,
    @Query('q') q?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('brands') brands?: string,
    @Query('occasions') occasions?: string,
    @Query('minRating') minRating?: string,
    @Query('inStock') inStock?: string,
    @Query('fastDelivery') fastDelivery?: string,
    @Query('featuredOnly') featuredOnly?: string,
    @Query('sort') sort?: string,
  ) {
    const minR =
      minRating !== undefined && minRating !== ''
        ? Number(minRating)
        : undefined;
    const sortNorm = this.normalizeSort(sort, q);
    return this.products.list({
      page,
      pageSize,
      categorySlug,
      q,
      minPrice:
        minPrice !== undefined && minPrice !== ''
          ? Number(minPrice)
          : undefined,
      maxPrice:
        maxPrice !== undefined && maxPrice !== ''
          ? Number(maxPrice)
          : undefined,
      brands: parseCsv(brands),
      occasions: parseCsv(occasions),
      minRating: minR !== undefined && !Number.isNaN(minR) ? minR : undefined,
      inStock: parseBool(inStock),
      fastDelivery: parseBool(fastDelivery),
      featuredOnly: parseBool(featuredOnly),
      sort: sortNorm,
    });
  }

  private normalizeSort(
    sort: string | undefined,
    q: string | undefined,
  ):
    | 'relevance'
    | 'featured'
    | 'price_asc'
    | 'price_desc'
    | 'newest'
    | 'rating_desc'
    | 'bestseller' {
    const allowed = [
      'relevance',
      'featured',
      'price_asc',
      'price_desc',
      'newest',
      'rating_desc',
      'bestseller',
    ] as const;
    if (sort && (allowed as readonly string[]).includes(sort)) {
      return sort as (typeof allowed)[number];
    }
    if (q?.trim()) {
      return 'relevance';
    }
    return 'featured';
  }

  @Public()
  @Get('meta/facets')
  facets() {
    return this.products.filterMeta();
  }

  @Patch('admin/catalog/:productId')
  @Roles(Role.SUPERADMIN)
  updateCatalog(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductCatalogDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    return this.products.updateCatalog(productId, dto, {
      userId: user.sub,
      ip,
    });
  }

  @Post('admin/upload-image')
  @Roles(Role.SUPERADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dest = join(process.cwd(), 'uploads', 'products');
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const safe =
            file.originalname.replace(/[^a-zA-Z0-9._-]/g, '').slice(-40) ||
            'image';
          const ext = extname(safe).toLowerCase();
          const base = safe.replace(ext, '').slice(0, 20) || 'img';
          cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`,
          );
        },
      }),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype.startsWith('image/'));
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      return { imageUrl: null };
    }
    const host = req.get('host') ?? `localhost:${process.env.PORT ?? 3000}`;
    const proto = req.protocol || 'http';
    return { imageUrl: `${proto}://${host}/uploads/products/${file.filename}` };
  }

  @Get('admin/:productId')
  @Roles(Role.SUPERADMIN)
  getAdminProduct(@Param('productId') productId: string) {
    return this.products.findByIdForAdmin(productId);
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.getBySlug(slug);
  }

  @Post()
  @Roles(Role.SUPERADMIN)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    return this.products.create(dto, { userId: user.sub, ip });
  }*/
}
