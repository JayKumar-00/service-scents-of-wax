import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { RetentionService } from '../retention.service';
import { NotificationAggregatorService } from 'src/notification/services/notification-aggregator.service';

@Injectable()
@Processor('retention')
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly retentionService: RetentionService,
    private readonly notificationAggregator: NotificationAggregatorService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const eventName = job.name;
    const data = job.data;
    this.logger.debug(
      `Processing retention queue job: ${eventName} (id: ${job.id})`,
    );

    try {
      switch (eventName) {
        case 'customer.registered':
          await this.retentionService.handleCustomerRegistered(data.customerId);
          break;

        case 'order.delivered':
          await this.retentionService.handleOrderDelivered(data.orderId);
          break;

        case 'order.cancelled':
          await this.retentionService.handleOrderCancelled(data.orderId);
          break;

        case 'review.approved':
          await this.retentionService.handleReviewApproved(data.reviewId);
          break;

        case 'newsletter.subscribed':
          await this.retentionService.handleNewsletterSubscribed(
            data.email,
            data.source,
            data.customerId,
          );
          break;

        case 'newsletter.unsubscribed':
          await this.retentionService.handleNewsletterUnsubscribed(
            data.email,
          );
          break;

        case 'activity.tracked':
          await this.retentionService.handleActivityTracked(data);
          break;

        case 'guest.merge':
          await this.retentionService.mergeGuestData(
            data.guestCustomerId,
            data.targetCustomerId,
          );
          break;

        case 'abandoned-cart.process':
          await this.notificationAggregator.addIntent({
            customerId: data.customerId,
            type: 'ABANDONED_CART',
            payload: {
              campaignId: data.abandonedCartId,
              title: 'Items left in your cart!',
              body: `We noticed you left some items in your cart. Complete your purchase now and use coupon ${data.couponCode} for ₹50 off!`,
            },
          });
          break;

        case 'viewed-but-not-purchased.process':
          await this.retentionService.handleViewedButNotPurchasedCampaign(
            data.customerId,
            data.productId ? [data.productId] : data.productIds,
          );
          break;

        default:
          this.logger.warn(`Unknown job name in retention queue: ${eventName}`);
          break;
      }
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `Failed processing retention job ${eventName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
