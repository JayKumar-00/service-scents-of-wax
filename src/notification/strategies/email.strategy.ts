import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrevoService } from 'src/notification/services/brevo.service';
import { OtpTemplate } from 'src/notification/templates/otp.template';
import { FranchiseActivationTemplate } from 'src/notification/templates/franchise-activation.template';
import { FranchiseRegistrationTemplate } from 'src/notification/templates/franchise-registration.template';
import { LowStockTemplate } from 'src/notification/templates/low-stock.template';
import { NewProductTemplate } from 'src/notification/templates/new-product.template';
import { NotificationEmailEnum } from '../templates/enums/notfication-email.enum';

@Injectable()
export class EmailStrategy {
  private readonly logger = new Logger(EmailStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevoService: BrevoService,
  ) {}

  async deliver(userId: string, notification: any): Promise<void> {
    try {
      // Get user email and franchise details from database if userId exists
      let userEmail: string | undefined = undefined;
      let franchiseName: string | undefined = undefined;
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
            franchise: {
              select: {
                name: true,
                businessName: true,
              },
            },
          },
        });
        userEmail = user?.email;
        if (user?.franchise) {
          franchiseName = user.franchise.businessName || user.franchise.name;
        }
      }

      const recipientEmail =
        notification?.metadata?.recipientEmail ||
        notification?.metadata?.ownerEmail ||
        notification?.metadata?.businessEmail ||
        userEmail;

      if (!recipientEmail) {
        this.logger.warn(
          `User ${userId} does not have an email address. Skipping email delivery.`,
        );
        return;
      }

      // Build HTML content for the email
      const recipientName =
        franchiseName ||
        notification?.metadata?.ownerName ||
        notification?.metadata?.userName ||
        recipientEmail.split('@')[0];

      const htmlContent =
        notification?.metadata?.htmlContent ||
        this.buildEmailContent(notification, recipientName);

      const attachment =
        notification?.metadata?.attachment ||
        notification?.metadata?.attachments;

      // Send email via Brevo
      await this.brevoService.sendEmail({
        to: recipientEmail,
        subject: notification.title,
        htmlContent,
        attachment,
      });

      this.logger.debug(
        `Email notification sent to ${recipientEmail} for user ${userId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send email notification to user ${userId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - log and continue (non-critical delivery)
    }
  }

  private buildEmailContent(
    notification: any,
    userName?: string | null,
  ): string {
    const type = String(notification?.type || 'SYSTEM');

    if (
      type === NotificationEmailEnum.NEW_PRODUCT ||
      (type === 'SYSTEM' &&
        notification?.title === 'New Product Available' &&
        notification?.metadata?.productId)
    ) {
      return NewProductTemplate.build({
        productName: notification?.metadata?.productName || 'New Product',
        productId: notification?.metadata?.productId,
        slug: notification?.metadata?.slug || '',
        imageUrl: notification?.metadata?.productImage,
        body: notification?.body,
      });
    }

    if (type === NotificationEmailEnum.OTP) {
      return OtpTemplate.build({
        otp: String(
          notification?.metadata?.otp || notification?.body || '',
        ).trim(),
        validMinutes: notification?.metadata?.validMinutes,
      });
    }

    if (type === NotificationEmailEnum.FRANCHISE_ACTIVATION) {
      return FranchiseActivationTemplate.build({
        businessName: notification?.metadata?.franchiseName || 'Your Franchise',
        franchiseCode: notification?.metadata?.franchiseCode || '',
        ownerName: userName,
        note: notification?.body,
      });
    }

    if (type === NotificationEmailEnum.FRANCHISE_REGISTRATION) {
      return FranchiseRegistrationTemplate.build({
        franchiseId: (notification?.metadata as any)?.franchiseId || '',
        franchiseName: notification?.metadata?.franchiseName || 'New Franchise',
        franchiseCode: notification?.metadata?.franchiseCode || '',
        ownerName: notification?.metadata?.ownerName,
        ownerEmail: notification?.metadata?.ownerEmail,
        kycStatus: notification?.metadata?.kycStatus,
      });
    }

    if (type === NotificationEmailEnum.LOW_STOCK) {
      return LowStockTemplate.build({
        franchiseName: userName || 'Franchise Partner',
        items: notification?.metadata?.items || [],
        title: notification.title,
      });
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
          </style>
        </head>
        <body>
          <p>${this.escapeHtml(userName ? `Hi ${userName},` : '')}</p>
          <h2>${this.escapeHtml(notification.title)}</h2>
          <p>${this.escapeHtml(notification.body).replace(/\n/g, '<br>')}</p>
        </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
