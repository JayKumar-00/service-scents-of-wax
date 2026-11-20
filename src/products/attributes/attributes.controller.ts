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
} from '@nestjs/common';
import {
  AttributesService,
  IAttributeNameValue,
  IAttributeValue,
} from './attributes.service';
import { AttributeQueryDto } from './dto/attribute-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import {
  UpdateAttributeDto,
  UpdateAttributeValueDto,
} from './dto/update.attribute.dto';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Attributes <- Admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPERADMIN, Role.ADMIN_STAFF) // Only superadmins can manage attributes
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  /**
   * Create a new attribute
   * Only admins can access this route
   *
   * @param dto CreateAttributeDto containing attribute details
   * @returns Created attribute wrapped in ISuccessResponse
   * @example
   * POST /admin/attributes
   * {
   *   "name": "Color",
   *   "slug": "color"
   * }
   */
  @Post()
  @ApiOperation({ summary: 'Create a new attribute' })
  @ApiResponse({ status: 201, description: 'Attribute created successfully' })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAttributeDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.create(user, dto, ip);
    return { data, message: 'Attribute created successfully' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IAttributeNameValue> {
    return this.attributesService.findOne(id);
  }

  /**
   * Get all product attributes
   *
   * Fetches all attributes with optional filters and pagination.
   *
   * @param query AttributeQueryDto containing filter and pagination info
   * @returns ISuccessResponse containing array of attributes and meta info
   *
   * @example
   * GET /admin/attributes?limit=10&page=1&search=color
   */
  @Get()
  @ApiOperation({ summary: 'Get all attributes' })
  async findAll(
    @Query() query: AttributeQueryDto,
  ): Promise<ISuccessResponse<IAttributeNameValue[], IMeta>> {
    const result = await this.attributesService.findAll(query);
    return { ...result };
  }

  /**
   * Get all values of a specific attribute by its ID
   *
   * Fetches all possible values for a given product attribute.
   *
   * @param attributeId The ID of the attribute whose values should be retrieved
   * @returns ISuccessResponse containing the attribute and its values
   *
   * @example
   * GET /admin/attributes/123/all/values
   */
  @Get(':attributeId/all/values')
  @ApiOperation({ summary: 'Get attribute by ID' })
  async valuesList(
    @Param('attributeId') attributeId: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.findOne(attributeId);
    return { data };
  }
  /**
   * Get a single attribute by its slug
   *
   * Fetches a product attribute using its slug identifier.
   *
   * @param slug The slug of the attribute (e.g., "color")
   * @returns ISuccessResponse containing the attribute and its details
   *
   * @example
   * GET /admin/attributes/color/single/value
   */
  @Get(':slug/single/value')
  @ApiOperation({ summary: 'Get attribute by Slug' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.findBySlug(slug);
    return { data };
  }

  /**
   * Get a specific attribute value by its ID
   *
   * Fetches a single attribute value for a product attribute using the value ID.
   *
   * @param attributeValueId The ID of the attribute value to retrieve
   * @returns ISuccessResponse containing the attribute value details
   *
   * @example
   * GET /admin/attributes/456/value
   */
  @Get(':attributeValueId/value')
  @ApiOperation({ summary: 'Get attribute attribute value by ID' })
  async findOneValueById(
    @Param('attributeValueId') attributeValueId: string,
  ): Promise<ISuccessResponse<IAttributeValue>> {
    const data =
      await this.attributesService.findOneValueById(attributeValueId);
    return { data };
  }

  /**
   * Update an existing attribute by its ID
   *
   * Allows admins to update the details of a product attribute.
   *
   * @param attributeId The ID of the attribute to update
   * @param dto UpdateAttributeDto containing new attribute details
   * @returns ISuccessResponse containing the updated attribute
   *
   * @example
   * PATCH /admin/attributes/123
   * {
   *   "name": "Size",
   *   "slug": "size"
   * }
   */
  @Patch(':attributeId')
  @ApiOperation({ summary: 'Update attribute' })
  async update(
    @CurrentUser() user: JwtUser,
    @Param('attributeId') attributeId: string,
    @Body() dto: UpdateAttributeDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.update(
      user,
      attributeId,
      dto,
      ip,
    );
    return { data, message: 'Attribute updated successfully' };
  }

  @Patch(':valueId/value')
  @ApiOperation({ summary: 'Update attribute value' })
  @ApiOperation({ summary: 'Update attribute' })
  async updateAttributeValue(
    @CurrentUser() user: JwtUser,
    @Param('valueId') valueId: string,
    @Body() dto: UpdateAttributeValueDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.updateValue(
      user,
      valueId,
      dto.title,
      ip,
    );
    return { data, message: 'Attribute value updated successfully' };
  }

  /**
   * Delete an attribute by its ID
   *
   * Allows admins to remove a product attribute from the system.
   *
   * @param attributeId The ID of the attribute to delete
   * @returns ISuccessResponse containing the deleted attribute
   *
   * @example
   * DELETE /admin/attributes/123
   */
  @Delete(':attributeId')
  @ApiOperation({ summary: 'Delete attribute' })
  async delete(
    @CurrentUser() user: JwtUser,
    @Param('attributeId') attributeId: string,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<IAttributeNameValue>> {
    const data = await this.attributesService.delete(user, attributeId, ip);
    return { data, message: 'Attribute deleted successfully' };
  }
}
