import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CustomerLifecycleStage,
  LoyaltyTier,
  ReferralStatus,
  Role,
} from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { RetentionService } from './retention.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { DeviceTokenDto, RemoveDeviceTokenDto } from './dto/device-token.dto';
import { SendCampaignDto } from './dto/send-campaign.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ProductAnalyticsQueryDto,
  UserAnalyticsQueryDto,
  CategoryAnalyticsQueryDto,
  BrandAnalyticsQueryDto,
} from './dto/anlytics-query.dto';

@ApiTags('Customer Retention & Loyalty')
@Controller('retention')
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly prisma: PrismaService,
    @InjectQueue('retention') private readonly retentionQueue: Queue,
  ) {}

  @Get('loyalty/balance')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Get current customer loyalty points, stage, and tier (Customer)',
  })
  async getLoyaltyBalance(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }

    let snapshot = await this.prisma.retentionSnapshot.findUnique({
      where: { customerId },
    });

    if (!snapshot) {
      await this.retentionService.handleCustomerRegistered(customerId);
      snapshot = await this.prisma.retentionSnapshot.findUnique({
        where: { customerId },
      });
    } else if (!snapshot.referralCode) {
      const generatedCode =
        await this.retentionService.generateAndSaveReferralCode(customerId);
      snapshot.referralCode = generatedCode;
    }

    return {
      success: true,
      data: snapshot,
    };
  }

  @Get('loyalty/points')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Get current customer loyalty points balance only (Customer)',
  })
  async getLoyaltyPoints(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      return { success: true, points: 0 };
    }

    const snapshot = await this.prisma.retentionSnapshot.findUnique({
      where: { customerId },
      select: { loyaltyPoints: true },
    });

    return {
      success: true,
      points: snapshot ? snapshot.loyaltyPoints : 0,
    };
  }

  @Get('loyalty/history')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Get customer loyalty points transaction history (Customer)',
  })
  async getLoyaltyHistory(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }

    const history = await this.prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: history,
    };
  }

  @Post('loyalty/redeem')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Redeem loyalty points for a cash discount coupon (Customer)',
  })
  async redeemPoints(
    @CurrentUser() user: JwtUser,
    @Body() dto: RedeemPointsDto,
  ) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }

    const couponCode = await this.retentionService.redeemPointsForCoupon(
      customerId,
      dto.points,
    );

    return {
      success: true,
      message: 'Points redeemed successfully',
      data: {
        pointsRedeemed: dto.points,
        couponCode,
      },
    };
  }

  @Post('referral/invite')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Refer a friend by sending their email (Customer)' })
  async inviteReferral(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateReferralDto,
  ) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }

    await this.retentionService.createReferralInvitation(
      customerId,
      dto.refereeEmail,
    );

    return {
      success: true,
      message: `Referral invite registered for ${dto.refereeEmail}`,
    };
  }

  @Public()
  @Post('newsletter/subscribe')
  @ApiOperation({ summary: 'Subscribe email to the marketing newsletter' })
  async subscribeNewsletter(@Body() dto: SubscribeNewsletterDto) {
    try {
      await Promise.race([
        this.retentionQueue.add('newsletter.subscribed', {
          email: dto.email,
          source: dto.source,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Queue timeout')), 1500),
        ),
      ]);
    } catch (error) {
      await this.retentionService.handleNewsletterSubscribed(
        dto.email,
        dto.source,
      );
    }

    return {
      success: true,
      message: 'Newsletter subscription received and is being processed.',
    };
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe email from the marketing newsletter' })
  async unsubscribeNewsletter(@Body() dto: UnsubscribeNewsletterDto) {
    try {
      await Promise.race([
        this.retentionQueue.add('newsletter.unsubscribed', {
          email: dto.email,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Queue timeout')), 1500),
        ),
      ]);
    } catch (error) {
      await this.retentionService.handleNewsletterUnsubscribed(
        dto.email,
      );
    }

    return {
      success: true,
      message: 'Newsletter unsubscription received and is being processed.',
    };
  }

  @Get('recommendations')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get product recommendations (Customer)' })
  async getRecommendations(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    const data = await this.retentionService.getRecommendedProducts(customerId);
    return { success: true, data };
  }

  @Get('segments')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get customer segments (Customer)' })
  async getSegments(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    const data = await this.retentionService.getCustomerSegments(customerId);
    return { success: true, data };
  }

  @Get('journey')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get customer journey timeline (Customer)' })
  async getJourney(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    const data = await this.retentionService.getJourneyTimeline(customerId);
    return { success: true, data };
  }

  @Get('abandoned-cart')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get active abandoned cart details (Customer)' })
  async getAbandonedCart(@CurrentUser() user: JwtUser) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    const data =
      await this.retentionService.getAbandonedCartDetails(customerId);
    return { success: true, data };
  }

  @Get('analytics/engagement')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get engagement analytics (Admin)' })
  async getEngagementAnalytics() {
    const data = await this.retentionService.getEngagementAnalytics();
    return { success: true, data };
  }

  @Get('analytics/categories')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Get category interest and engagement analytics (Admin)',
  })
  async getCategoryEngagementAnalytics(
    @Query() query: CategoryAnalyticsQueryDto,
  ) {
    return await this.retentionService.getCategoryEngagementAnalytics(query);
  }

  @Get('analytics/categories/slug/:slug')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'Get category interest and engagement analytics for a specific category by slug (Admin)',
  })
  async getCategoryEngagementAnalyticsBySlug(@Param('slug') slug: string) {
    const data =
      await this.retentionService.getCategoryEngagementAnalyticsBySlug(slug);
    return {
      success: true,
      data,
    };
  }

  @Get('analytics/brands')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Get brand interest and engagement analytics (Admin)',
  })
  async getBrandEngagementAnalytics(@Query() query: BrandAnalyticsQueryDto) {
    return await this.retentionService.getBrandEngagementAnalytics(query);
  }

  @Get('analytics/brands/slug/:slug')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'Get brand interest and engagement analytics for a specific brand by slug (Admin)',
  })
  async getBrandEngagementAnalyticsBySlug(@Param('slug') slug: string) {
    const data =
      await this.retentionService.getBrandEngagementAnalyticsBySlug(slug);
    return {
      success: true,
      data,
    };
  }

  @Get('analytics/products')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary: 'Get product interest and engagement analytics (Admin)',
  })
  async getProductEngagementAnalytics(
    @Query() query: ProductAnalyticsQueryDto,
  ): Promise<{
    data: {
      productId: string;
      productName: string;
      categoryId: string;
      categoryName: string;
      vendorId: string;
      vendorName: string;
      userCount: number;
      totalScore: number;
      avgScore: number;
      totalViews: number;
      totalWishlists: number;
      totalCartAdds: number;
      totalOrders: number;
      avgEngagement: number;
    }[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      appliedFilters: {
        categoryId: string | null;
        search: string | null;
      };
    };
  }> {
    return await this.retentionService.getProductEngagementAnalytics(query);
  }

  @Get('analytics/products/:productId')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'Get product interest and engagement analytics for a specific product (Admin)',
  })
  async getProductEngagementAnalyticsById(
    @Param('productId') productId: string,
  ) {
    const data =
      await this.retentionService.getProductEngagementAnalyticsById(productId);
    return {
      success: true,
      data,
    };
  }

  @Get('analytics/user-activity')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get user interest and activity analytics (Admin)' })
  async getUserActivityAnalytics(@Query() query: UserAnalyticsQueryDto) {
    const data = await this.retentionService.getUserActivityAnalytics(query);
    return { success: true, data };
  }

  @Get('analytics/user-activity/user/:userId')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'Get user interest and activity analytics for a specific user by ID (Admin)',
  })
  async getUserActivityAnalyticsByUserId(@Param('userId') userId: string) {
    const data = await this.retentionService.getUserActivityAnalytics({
      userId,
    });
    return { success: true, data };
  }

  @Get('analytics/campaigns')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Get campaign and coupon analytics (Admin)' })
  async getCampaignAnalytics() {
    const data = await this.retentionService.getCampaignAnalytics();
    const coupons = await this.retentionService.getCouponAnalytics();
    return { success: true, data: { ...data, coupons } };
  }

  @Post('campaign/send')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Send campaign (Admin)' })
  async sendCampaign(@Body() dto: SendCampaignDto) {
    const result = await this.retentionService.sendCampaign(dto);
    return { success: true, ...result };
  }

  @Post('device-token')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Register device token (Customer)' })
  async registerDeviceToken(
    @CurrentUser() user: JwtUser,
    @Body() dto: DeviceTokenDto,
  ) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    await this.retentionService.registerDeviceToken(
      customerId,
      dto.token,
      dto.os,
    );
    return { success: true, message: 'Device token registered successfully' };
  }

  @Post('device-token/remove')
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Remove device token (Customer)' })
  async removeDeviceToken(
    @CurrentUser() user: JwtUser,
    @Body() dto: RemoveDeviceTokenDto,
  ) {
    const customerId = user.customerId;
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }
    await this.retentionService.removeDeviceToken(customerId, dto.token);
    return { success: true, message: 'Device token removed successfully' };
  }

  @Get('admin/analytics')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({
    summary:
      'Get complete customer retention and lifecycle analytics (Admin Staff, SuperAdmin)',
  })
  async getAdminRetentionAnalytics() {
    const rawStages = await this.prisma.retentionSnapshot.groupBy({
      by: ['stage'],
      _count: { customerId: true },
    });

    const stages = Object.values(CustomerLifecycleStage).reduce(
      (acc, stage) => {
        const found = rawStages.find((r) => r.stage === stage);
        acc[stage] = found ? found._count.customerId : 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const rawTiers = await this.prisma.retentionSnapshot.groupBy({
      by: ['tier'],
      _count: { customerId: true },
    });

    const tiers = Object.values(LoyaltyTier).reduce(
      (acc, tier) => {
        const found = rawTiers.find((r) => r.tier === tier);
        acc[tier] = found ? found._count.customerId : 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalCustomers = await this.prisma.retentionSnapshot.count();
    const aggregateData = await this.prisma.retentionSnapshot.aggregate({
      _sum: { totalSpend: true, loyaltyPoints: true },
      _avg: { totalSpend: true },
    });

    const totalSpendSum = Number(aggregateData._sum.totalSpend || 0);
    const averageCLV = Number(aggregateData._avg.totalSpend || 0);
    const totalPointsSum = aggregateData._sum.loyaltyPoints || 0;

    const orderAggregate = await this.prisma.order.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { total: true },
    });

    const activeOrdersCount = orderAggregate._count.id;
    const activeOrdersSum = Number(orderAggregate._sum.total || 0);
    const averageOrderValue =
      activeOrdersCount > 0
        ? Number((activeOrdersSum / activeOrdersCount).toFixed(2))
        : 0;

    const subscribersCount = await this.prisma.newsletterSubscriber.count({
      where: { status: 'SUBSCRIBED' },
    });

    const completedReferrals = await this.prisma.referral.count({
      where: { status: ReferralStatus.COMPLETED },
    });

    return {
      success: true,
      data: {
        customers: {
          total: totalCustomers,
          byStage: stages,
          byTier: tiers,
        },
        financials: {
          totalSpend: totalSpendSum,
          averageCLV: Number(averageCLV.toFixed(2)),
          totalLoyaltyPoints: totalPointsSum,
        },
        orders: {
          activeCount: activeOrdersCount,
          totalValue: activeOrdersSum,
          averageOrderValue,
        },
        newsletter: {
          activeSubscribers: subscribersCount,
        },
        referrals: {
          successfulCount: completedReferrals,
        },
      },
    };
  }
}
