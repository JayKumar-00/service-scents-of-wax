import { Module } from '@nestjs/common';
import { ElasticSearchController } from './elastic-search.controller';
import { SearchHistoryController } from './search-history.controller';
import { SearchHistoryService } from './services/search-history.service';
import { SmartSearchService } from './services/smart-search.service';
import { SearchSuggestionsService } from './services/search-suggestions.service';
import { TranslateService } from './services/translate.service';
import { WarehouseModule } from 'src/warehouse/warehouse.module';

@Module({
  imports: [WarehouseModule],
  controllers: [ElasticSearchController, SearchHistoryController],
  providers: [
    SearchHistoryService,
    SmartSearchService,
    SearchSuggestionsService,
    TranslateService,
  ],
})
export class ElasticSearchModule {}
