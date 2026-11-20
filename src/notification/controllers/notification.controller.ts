import {
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Body,
  Delete,
  Query,
} from '@nestjs/common';
import { LowStockAlertCron } from '../crons/low-stock-alert.cron';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { RoleBasedNotificationService } from '../services/role-based-notification.service';
import {
  CreateNotificationDto,
  UpdateNotificationPreferencesDto,
  SendToFranchiseOwnerDto,
  SendToFranchiseStaffDto,
  SendToSuperAdminsDto,
  SendToAdminsDto,
} from '../dto/create-notification.dto';
import { DeleteNotificationsDto } from '../dto/delete-notifications.dto';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags(
  'Notifications <- Superadmin, Franchise Owner, Franchise Staff, Customer',
)
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly roleBasedService: RoleBasedNotificationService,
    private readonly lowStockAlertCron: LowStockAlertCron,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
  async myNotifications(@CurrentUser() user: JwtUser) {
    return this.prisma.notification.findMany({
      where: {
        userId: user.sub,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  @Get('sendbox')
  @ApiOperation({ summary: 'Get notifications sent by the current user' })
  async getSendbox(@CurrentUser() user: JwtUser) {
    return this.prisma.notification.findMany({
      where: {
        metadata: {
          path: ['sentByUserId'],
          equals: user.sub,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  @Delete()
  @ApiOperation({ summary: 'Delete multiple notifications' })
  async deleteNotifications(
    @CurrentUser() user: JwtUser,
    @Body() dto: DeleteNotificationsDto,
  ) {
    const result = await this.prisma.notification.deleteMany({
      where: {
        id: { in: dto.ids },
        // Security check: Ensures a user can only delete their own notifications
        userId: user.sub,
      },
    });

    return {
      success: true,
      count: result.count,
      message: `Deleted ${result.count} notification(s)`,
    };
  }

  /**
   * Get current user's notification preferences
   */
  @Get('preferences/mine')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getMyPreferences(@CurrentUser() user: JwtUser) {
    return this.preferenceService.getPreferences(user.sub);
  }

  /**
   * Update current user's notification preferences
   */
  @Patch('preferences/mine')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  async updateMyPreferences(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.preferenceService.upsertPreferences(user.sub, dto);
  }

  /**
   * SUPERADMIN: Send notification to all superadmins
   */
  @Post('admin/send-to-superadmins')
  async sendToSuperAdmins(
    @CurrentUser() user: JwtUser,
    @Body() dto: SendToSuperAdminsDto,
  ) {
    // Only superadmins can send to superadmins
    if (user.role !== Role.SUPERADMIN) {
      throw new Error('Only superadmins can send to superadmins');
    }
    const enrichedMetadata = {
      sentByUserId: user.sub,
      sentByRole: user.role,
      ...dto.metadata,
    };
    const count = await this.roleBasedService.notifySuperAdmins(
      dto.title,
      dto.body,
      enrichedMetadata,
    );
    return { success: true, count, message: `Sent to ${count} superadmins` };
  }

  /**
   * SUPERADMIN: Send notification to specific franchise owner
   */
  @Post('admin/send-to-franchise-owner/:franchiseId')
  async sendToFranchiseOwner(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Body() dto: SendToFranchiseOwnerDto,
  ) {
    if (user.role !== Role.SUPERADMIN) {
      throw new Error('Only superadmins can send to franchise owners');
    }
    const enrichedMetadata = {
      sentByUserId: user.sub,
      sentByRole: user.role,
      ...dto.metadata,
    };
    const count = await this.roleBasedService.notifyFranchiseOwner(
      franchiseId,
      dto.title,
      dto.body,
      dto.type,
      enrichedMetadata,
    );
    return {
      success: true,
      count,
      message: `Sent to ${count} franchise owner(s)`,
    };
  }

  /**
   * SUPERADMIN: Send notification to franchise staff
   */
  @Post('admin/send-to-franchise-staff/:franchiseId')
  async sendToFranchiseStaff(
    @CurrentUser() user: JwtUser,
    @Param('franchiseId') franchiseId: string,
    @Body() dto: SendToFranchiseStaffDto,
  ) {
    if (user.role !== Role.SUPERADMIN) {
      throw new Error('Only superadmins can send to franchise staff');
    }
    const enrichedMetadata = {
      sentByUserId: user.sub,
      sentByRole: user.role,
      ...dto.metadata,
    };
    const count = await this.roleBasedService.notifyFranchiseStaff(
      franchiseId,
      dto.title,
      dto.body,
      dto.type,
      enrichedMetadata,
    );
    return {
      success: true,
      count,
      message: `Sent to ${count} staff member(s)`,
    };
  }

  /**
   * FRANCHISE_OWNER: Send to own staff
   */
  @Post('franchise/send-to-staff')
  async sendToOwnStaff(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateNotificationDto,
  ) {
    if (user.role !== Role.FRANCHISE_OWNER && user.role !== Role.SUPERADMIN) {
      throw new Error('Only franchise owners can send to their staff');
    }
    const franchiseId = user.franchiseId ?? user.franchiseOwnerId;

    if (!franchiseId) {
      throw new Error('Franchise ID not found for user');
    }

    const enrichedMetadata = {
      sentByUserId: user.sub,
      sentByRole: user.role,
      ...dto.metadata,
    };

    const count = await this.roleBasedService.notifyFranchiseStaff(
      franchiseId,
      dto.title,
      dto.body,
      dto.type,
      enrichedMetadata,
    );
    return {
      success: true,
      count,
      message: `Sent to ${count} staff member(s)`,
    };
  }

  /**
   * FRANCHISE_OWNER / FRANCHISE_STAFF: Send notification to superadmins
   * For: Escalations, urgent issues, support requests
   */
  @Post('franchise/send-to-admins')
  async sendToAdmins(
    @CurrentUser() user: JwtUser,
    @Body() dto: SendToAdminsDto,
  ) {
    if (
      user.role !== Role.FRANCHISE_OWNER &&
      user.role !== Role.FRANCHISE_STAFF
    ) {
      throw new Error('Only franchise users can send to admins');
    }

    const franchiseId = user.franchiseId ?? user.franchiseOwnerId;
    if (!franchiseId) {
      throw new Error('Franchise ID not found for user');
    }

    // Enrich metadata with franchise info
    const enrichedMetadata = {
      franchiseId,
      sentByUserId: user.sub,
      sentByRole: user.role,
      ...dto.metadata,
    };

    const count = await this.roleBasedService.notifySuperAdmins(
      dto.title,
      dto.body,
      enrichedMetadata,
    );
    return {
      success: true,
      count,
      message: `Sent to ${count} superadmin(s)`,
    };
  }

  /**
   * SUPERADMIN: Trigger manual low-stock check
   */
  @Post('admin/trigger-low-stock-check')
  @ApiOperation({ summary: 'Trigger manual stateful low-stock inventory check' })
  async triggerLowStockCheck(
    @CurrentUser() user: JwtUser,
    @Query('force') forceQuery?: string,
  ) {
    if (user.role !== Role.SUPERADMIN) {
      throw new Error('Only superadmins can trigger low stock checks');
    }

    const force = forceQuery === 'true';
    const result = await this.lowStockAlertCron.runScan(force);

    return {
      success: true,
      message: `Successfully executed inventory scan (force: ${force})`,
      data: result,
    };
  }
}
