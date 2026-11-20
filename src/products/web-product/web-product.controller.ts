import { Controller, Get, Param, Query, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  ApiHeaders,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WebProductQueryDto } from './dto/web-product-query.dto';
import { WebProductService } from './web-product.service';
import { ISuccessResponse } from 'src/common/interceptors/envelope.interface';
import { IMeta } from 'src/common/interceptors/envelope.interface';
import { Public } from 'src/common/decorators/public.decorator';
import { RetentionService } from 'src/retention/retention.service';
import { CustomerActivityType } from '@prisma/client';
import { Request } from 'express';

/**
 * Public product API for storefront (no auth).
 * Base path: api/v1/web/products
 */
@Public()
@ApiTags('Products <- Web (Public)')
@Controller({
  path: 'web/products',
  scope: Scope.REQUEST,
})
export class WebProductController {
  constructor(
    private readonly webProductService: WebProductService,
    private readonly retentionService: RetentionService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List products for storefront (approved, public) with search, filters, sorting & pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated product list with related brands & categories',
  })
  async findAll(
    @Query() query: WebProductQueryDto,
  ): Promise<ISuccessResponse<any[], IMeta>> {
    const result = await this.webProductService.findAll(query);

    const authHeader = this.request.headers.authorization;
    const deviceId = this.request.headers['x-device-id'] as string;
    const ip = this.request.ip;
    let customerId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString(
          'ascii',
        );
        const payload = JSON.parse(payloadStr);
        if (payload && payload.customerId) {
          customerId = payload.customerId;
        }
      } catch (err) {}
    }

    if (!customerId && (deviceId || ip)) {
      // Resolve/create guest customer ID asynchronously
      this.retentionService
        .getOrCreateGuestCustomerId(deviceId, ip)
        .then((guestId) => {
          if (guestId) {
            if (query.search && query.search.trim().length > 0) {
              this.retentionService
                .trackActivity(guestId, CustomerActivityType.SEARCH, {
                  search: query.search,
                  deviceId,
                  ip,
                })
                .catch(() => {});
            }
            if (query.categoryId || query.categorySlug) {
              this.retentionService
                .trackActivity(guestId, CustomerActivityType.CATEGORY_VIEW, {
                  categoryId: query.categoryId,
                  categorySlug: query.categorySlug,
                  deviceId,
                  ip,
                })
                .catch(() => {});
            }
            if (query.brandId || query.brands) {
              this.retentionService
                .trackActivity(guestId, CustomerActivityType.SEARCH, {
                  brandId: query.brandId,
                  brands: query.brands,
                  deviceId,
                  ip,
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    } else if (customerId) {
      if (query.search && query.search.trim().length > 0) {
        this.retentionService
          .trackActivity(customerId, CustomerActivityType.SEARCH, {
            search: query.search,
            deviceId,
            ip,
          })
          .catch(() => {});
      }
      if (query.categoryId || query.categorySlug) {
        this.retentionService
          .trackActivity(customerId, CustomerActivityType.CATEGORY_VIEW, {
            categoryId: query.categoryId,
            categorySlug: query.categorySlug,
            deviceId,
            ip,
          })
          .catch(() => {});
      }
      if (query.brandId || query.brands) {
        this.retentionService
          .trackActivity(customerId, CustomerActivityType.SEARCH, {
            brandId: query.brandId,
            brands: query.brands,
            deviceId,
            ip,
          })
          .catch(() => {});
      }
    }

    return { ...result };
  }

  // @Get('suggest')
  // @ApiOperation({
  //   summary:
  //     'Search suggestions / autocomplete by product name, brand, or category',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'List of matching suggestions (products, brands, categories)',
  // })
  // async suggest(@Query('q') q: string): Promise<ISuccessResponse<any[]>> {
  //   const data = await this.webProductService.suggest(q || '');
  //   return { data };
  // }

  @Get('featured')
  @ApiOperation({ summary: 'Featured products for homepage' })
  @ApiResponse({ status: 200, description: 'List of featured products' })
  async findFeatured(): Promise<ISuccessResponse<any[]>> {
    const data = await this.webProductService.findFeatured();
    return { data };
  }

  @Get('trending')
  @ApiOperation({
    summary: 'Trending products or product variants (flat list)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trending products or variants in a flat structure',
  })
  async findTrending(
    @Query('limit') limit?: string,
  ): Promise<ISuccessResponse<any[]>> {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    const data = await this.webProductService.tredingProduct(limitNum);
    return { data };
  }

  @Get('deals')
  @ApiOperation({
    summary: 'Deal products with discounts (MRP > Selling Price)',
  })
  @ApiResponse({ status: 200, description: 'List of deal products' })
  async findDeals(
    @Query('limit') limit?: string,
  ): Promise<ISuccessResponse<any[]>> {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 12, 24) : 12;
    const data = await this.webProductService.findDeals(limitNum);
    return { data };
  }

  @Get('recommended')
  @ApiOperation({
    summary: 'Recommended products based on ratings & popularity',
  })
  @ApiResponse({ status: 200, description: 'List of recommended products' })
  async findRecommended(
    @Query('limit') limit?: string,
  ): Promise<ISuccessResponse<any[]>> {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 12, 24) : 12;

    const authHeader = this.request.headers.authorization;
    const deviceId = this.request.headers['x-device-id'] as string;
    const ip = this.request.ip;
    let customerId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString(
          'ascii',
        );
        const payload = JSON.parse(payloadStr);
        if (payload && payload.customerId) {
          customerId = payload.customerId;
        }
      } catch (err) {}
    }

    if (!customerId && (deviceId || ip)) {
      customerId = await this.retentionService.getOrCreateGuestCustomerId(
        deviceId,
        ip,
      );
    }

    if (customerId) {
      try {
        const data =
          await this.retentionService.getRecommendedProducts(customerId);
        if (data && data.length > 0) {
          return { data: data.slice(0, limitNum) };
        }
      } catch (err) {}
    }

    const data = await this.webProductService.findRecommended(limitNum);
    return { data };
  }

  @Get(':productId/related')
  @ApiOperation({
    summary: 'Related products from same category',
  })
  @ApiResponse({ status: 200, description: 'List of related products' })
  async findRelated(
    @Param('productId') productId: string,
  ): Promise<ISuccessResponse<any[]>> {
    const data = await this.webProductService.findRelated(productId);
    return { data };
  }

  /**
   * COMMENTED OUT: notifyInStock requires NotifyInStockService which is not implemented
   * Uncomment and implement when the NotifyInStockService is available
   */
  // @Post(':productId/notify-in-stock')
  // @ApiOperation({
  //   summary: 'Subscribe to notify when product is back in stock',
  // })
  // @ApiResponse({ status: 201, description: 'Subscription registered' })
  // async notifyInStock(
  //   @Param('productId') productId: string,
  //   @Body() dto: { email: string },
  // ) {
  //   const data = await this.notifyInStockService.subscribe(
  //     productId,
  //     dto.email,
  //   );
  //   return {
  //     data,
  //     message: 'You will be notified when this product is back in stock',
  //   };
  // }

  @Get(':productId')
  @ApiOperation({ summary: 'Get product detail by ID for storefront' })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Optional customer ID for tracking (can be anonymous)',
  })
  @ApiHeaders([
    {
      name: 'x-affiliate-session-id',
      required: false,
      description:
        'Affiliate session ID for tracking (currently not implemented)',
    },
  ])
  @ApiResponse({ status: 200, description: 'Product detail with related info' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(
    @Param('productId') productId: string,
  ): Promise<ISuccessResponse<any>> {
    const data = await this.webProductService.findOne(productId);

    const authHeader = this.request.headers.authorization;
    const deviceId = this.request.headers['x-device-id'] as string;
    const ip = this.request.ip;
    let customerId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString(
          'ascii',
        );
        const payload = JSON.parse(payloadStr);
        if (payload && payload.customerId) {
          customerId = payload.customerId;
        }
      } catch (err) {}
    }

    if (!customerId && (deviceId || ip)) {
      // Resolve/create guest customer ID asynchronously
      this.retentionService
        .getOrCreateGuestCustomerId(deviceId, ip)
        .then((guestId) => {
          if (guestId) {
            this.retentionService
              .trackActivity(guestId, CustomerActivityType.PRODUCT_VIEW, {
                productId: data?.id || productId,
                categoryId: data?.category?.id || undefined,
                deviceId,
                ip,
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else if (customerId) {
      this.retentionService
        .trackActivity(customerId, CustomerActivityType.PRODUCT_VIEW, {
          productId: data?.id || productId,
          categoryId: data?.category?.id || undefined,
          deviceId,
          ip,
        })
        .catch(() => {});
    }

    /**
     * COMMENTED OUT: affiliateRetentionService is not implemented
     * Uncomment and implement when the AffiliateRetentionService is available
     */
    // if (affiliateSessionId && (data as any)?._id) {
    //   try {
    //     await this.affiliateRetentionService.trackProductView(
    //       affiliateSessionId,
    //       { productId: (data as any)._id.toString() },
    //     );
    //   } catch (error) {
    //     console.error('Failed to track affiliate product view event:', error);
    //   }
    // }

    /**
     * COMMENTED OUT: retentionEventBus is not implemented
     * Uncomment and implement when the RetentionEventBus is available
     */
    // Track product view in retention system (no auth required)
    // if (data) {
    //   try {
    //     // Use provided customerId, or generate anonymous one
    //     const userId = customerId || `anonymous_${Date.now()}`;

    //     const productViewEvent = {
    //       eventId: `product_view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    //       occurredAt: new Date(),
    //       userId,
    //       userEmail: customerId
    //         ? customerId + '@anonymous.local'
    //         : 'anonymous@example.com',
    //       product: {
    //         productId: (data as any).id || productId,
    //         productName: (data as any).name || 'Unknown Product',
    //         categoryId: (data as any).category?.id || '',
    //         categoryName: (data as any).category?.name || '',
    //         price: (data as any).price || 0,
    //         imageUrl: (data as any).imageUrl || null,
    //       },
    //     };

    //     // Emit the retention event (async, doesn't block response)
    //     this.retentionEventBus.emitProductViewed(productViewEvent);
    //   } catch (error) {
    //     console.error(
    //       `[Retention] Error emitting product view event: ${error instanceof Error ? error.message : String(error)}`,
    //     );
    //     // Don't block the response if tracking fails
    //   }
    // }

    return { data };
  }
}
