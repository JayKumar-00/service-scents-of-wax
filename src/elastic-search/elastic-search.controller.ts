import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { SearchSuggestionsService } from './services/search-suggestions.service';
import { SmartSearchService } from './services/smart-search.service';
import { ElasticSearchQueryDto } from './dto/ealstic-search.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Elastic Search')
@Controller('elastic-search')
export class ElasticSearchController {
  constructor(
    private readonly smartSearchService: SmartSearchService,
    private readonly searchSuggestionsService: SearchSuggestionsService,
  ) {}

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Search products with filters and pagination' })
  async products(@Query() query: ElasticSearchQueryDto) {
    if (query.autoComplete !== undefined) {
      return this.smartSearchService.autoCompleteSuggestions(query);
    }
    return this.smartSearchService.search(query);
  }

  @ApiBearerAuth('access-token')
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  @Get('products-authorized')
  @ApiOperation({
    summary: 'Search products for Franchise and Admin users with full details',
  })
  async productsAuthorized(
    @Query() query: ElasticSearchQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (query.autoComplete !== undefined) {
      return this.smartSearchService.autoCompleteSuggestions(query);
    }
    return this.smartSearchService.search(query, user);
  }

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: 'Search suggestions and autocomplete' })
  @ApiQuery({ name: 'q', required: true })
  async suggest(@Query('q') q: string) {
    const data = await this.searchSuggestionsService.suggest(q || '');
    return { data };
  }

  @Public()
  @Get('ai-search')
  @ApiOperation({ summary: 'AI-assisted product search' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'provider', required: false, enum: ['ollama', 'gemini'] })
  async aiSearch(@Query() query: Record<string, any>) {
    return this.smartSearchService.aiSearch(query);
  }

  @Public()
  @Get('ai-search/test')
  @ApiOperation({ summary: 'Debug AI query normalization and expansion' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'provider', required: false, enum: ['ollama', 'gemini'] })
  async aiSearchTest(@Query() query: Record<string, any>) {
    return this.smartSearchService.testAiSearch(query);
  }
}
