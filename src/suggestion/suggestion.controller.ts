import {
  Controller,
  Get,
  Param,
  Query,
  Delete,
  Post,
  Body,
} from '@nestjs/common';
import { SuggestionService } from './suggestion.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchProviderType } from './search-provider.interface';
import { UpsertKeywordDto } from './dto/upsert-keyword.dto';

@ApiTags(
  'Suggestion (Keyword Generation, Auto-complete, etc.) <- SuperAdmin, Admin Staff',
)
@ApiBearerAuth('access-token')
@Controller('suggestion')
export class SuggestionController {
  constructor(private readonly suggestionService: SuggestionService) {}

  @Get('get-keywords/:productName')
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async generateKeywords(
    @Param('productName') productName: string,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.getKeywords(productName, provider);
  }

  @Delete('delete-keyword/:query')
  async deleteKeyword(@Param('query') query: string) {
    return this.suggestionService.deleteKeyword(query);
  }

  @Delete('clear-all-keywords')
  async clearAllKeywords() {
    return this.suggestionService.clearAllKeywords();
  }

  @Post('upsert-keyword')
  async upsertKeyword(@Body() dto: UpsertKeywordDto) {
    return this.suggestionService.upsertKeyword(
      dto.query,
      dto.suggestions,
      dto.provider,
    );
  }

  @Get('search-images')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'num', required: false, type: Number })
  @ApiQuery({ name: 'safe', required: false })
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async searchImages(
    @Query('q') q: string,
    @Query('num') num?: number,
    @Query('safe') safe?: string,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.searchImages(q, num, safe, provider);
  }

  @Get('search-organic')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'num', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async searchOrganic(
    @Query('q') q: string,
    @Query('num') num?: number,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.searchOrganic(q, num, provider);
  }

  @Get('search-news')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'num', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async searchNews(
    @Query('q') q: string,
    @Query('num') num?: number,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.searchNews(q, num, provider);
  }

  @Get('search-videos')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'num', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async searchVideos(
    @Query('q') q: string,
    @Query('num') num?: number,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.searchVideos(q, num, provider);
  }

  @Get('search-shopping')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'num', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, enum: SearchProviderType })
  async searchShopping(
    @Query('q') q: string,
    @Query('num') num?: number,
    @Query('provider') provider?: SearchProviderType,
  ) {
    return this.suggestionService.searchShopping(q, num, provider);
  }

  @Get('google-suggestions')
  @ApiQuery({ name: 'q', required: true })
  async getGoogleSuggestions(@Query('q') q: string) {
    return this.suggestionService.getGoogleSuggestions(q);
  }
}
