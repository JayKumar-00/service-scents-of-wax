import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Ip,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { MediaLibraryService } from './media-library.service';
import { MediaQueryDto } from './dto/media-query.dto';
import { CreateMediaItemDto } from './dto/create-media.dto';
import { UpdateMediaItemDto } from './dto/update-media.dto';
import {
  IMeta,
  ISuccessResponse,
} from 'src/common/interceptors/envelope.interface';
import { PermissionModule } from 'src/common/decorators/permission-module.decorator';
import { SuperAdminModuleEnum } from 'src/staff-management/enums/module-name.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@ApiTags('Media Library <- Admin')
@ApiBearerAuth('access-token')
@Controller('media-library')
export class MediaLibraryController {
  constructor(private readonly mediaLibrary: MediaLibraryService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'List media items with pagination and search' })
  async list(
    @Query() query: MediaQueryDto,
  ): Promise<ISuccessResponse<unknown[], IMeta>> {
    return this.mediaLibrary.listAcutal(query);
  }

  // @Get(':id')
  // @Public()
  // @ApiOperation({ summary: 'Get media item by ID' })
  // async findById(@Param('id') id: string) {
  //   return this.mediaLibrary.findById(id);
  // }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upload/create a media item' })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMediaItemDto,
    @Ip() ip: string,
  ) {
    return this.mediaLibrary.create(user, dto, ip);
  }

  // @Patch(':id')
  // @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  // @ApiOperation({ summary: 'Update a media item' })
  // async update(@Param('id') id: string, @Body() dto: UpdateMediaItemDto) {
  //   return this.mediaLibrary.update(id, dto);
  // }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @PermissionModule(SuperAdminModuleEnum.MEDIA_LIBRARY)
  @ApiOperation({ summary: 'Delete a media item' })
  async delete(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.mediaLibrary.delete(user, id, ip);
  }

  @Post('upload')
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  @ApiOperation({ summary: 'Upload a file (multipart)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    const dto: CreateMediaItemDto = {
      url: `/uploads/${file.filename}`,
      key: file.originalname,
      mimeType: file.mimetype,
      size: String(file.size),
    };
    return this.mediaLibrary.create(user, dto, ip);
  }
}
