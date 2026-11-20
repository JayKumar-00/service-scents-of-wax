import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ISuccessResponse } from 'src/common/interceptors/envelope.interface';
import { CreateFaqDto } from './dto/create-faq.dto';
import { FaqQueryDto } from './dto/faq-query.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqService } from './faq.service';
import { FaqItem, FaqPaginationMeta } from './interfaces/faq.interface';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { SuperAdminModuleEnum } from 'src/staff-management/enums/module-name.enum';

@ApiTags('FAQs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'List published FAQs' })
  async listPublic(
    @Query() query: FaqQueryDto,
  ): Promise<ISuccessResponse<FaqItem[], FaqPaginationMeta>> {
    const result = await this.faqService.publicList(query);

    return {
      data: result.data,
      meta: result.meta,
    };
  }

  @Public()
  @Get('faqs/:id')
  @ApiOperation({ summary: 'Get a published FAQ by ID' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  async details(@Param('id') id: string): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.publicDetails(id);

    return {
      data: faq,
    };
  }

  @Post('faqs')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Create a new FAQ' })
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiBody({ type: CreateFaqDto })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFaqDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.create(user, dto, ip);

    return {
      data: faq,
      message: 'FAQ created successfully',
    };
  }

  @Patch('faqs/:id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'Update an FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  @ApiBody({ type: UpdateFaqDto })
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.update(user, id, dto, ip);

    return {
      data: faq,
      message: 'FAQ updated successfully',
    };
  }

  @Delete('faqs/:id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'Soft delete an FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.remove(user, id, ip);

    return {
      data: faq,
      message: 'FAQ deleted successfully',
    };
  }

  @Patch('faqs/:id/restore')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'Restore a soft-deleted FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  async restore(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.restore(user, id);

    return {
      data: faq,
      message: 'FAQ restored successfully',
    };
  }

  @Patch('faqs/:id/publish')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'Publish an FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  async publish(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.publish(user, id);

    return {
      data: faq,
      message: 'FAQ published successfully',
    };
  }

  @Patch('faqs/:id/unpublish')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'Unpublish an FAQ' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  async unpublish(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ISuccessResponse<FaqItem>> {
    const faq = await this.faqService.unpublish(user, id);

    return {
      data: faq,
      message: 'FAQ unpublished successfully',
    };
  }

  @Get('admin/faqs')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.FAQ)
  @ApiOperation({ summary: 'List all FAQs for admin' })
  async adminList(
    @Query() query: FaqQueryDto,
  ): Promise<ISuccessResponse<FaqItem[], FaqPaginationMeta>> {
    const result = await this.faqService.adminList(query);

    return {
      data: result.data,
      meta: result.meta,
    };
  }

  // @Roles(Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  // @Get('franchise/faqs')
  // @ApiOperation({ summary: 'List FAQs created by the current franchise user' })
  // async franchiseList(
  //   @CurrentUser() user: JwtUser,
  //   @Query() query: FaqQueryDto,
  // ): Promise<ISuccessResponse<FaqItem[], FaqPaginationMeta>> {
  //   const result = await this.faqService.franchiseList(user, query);

  //   return {
  //     data: result.data,
  //     meta: result.meta,
  //   };
  // }
}
