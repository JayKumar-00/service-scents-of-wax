import { Module } from '@nestjs/common';
import { SuggestionService } from './suggestion.service';
import { SuggestionController } from './suggestion.controller';
import { SearchApiProvider } from './providers/searchapi.provider';
import { SerpSearchApiProvider } from './providers/serpsearch.provider';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if necessary

@Module({
  providers: [
    SearchApiProvider,
    SerpSearchApiProvider,
    SuggestionService,
    PrismaService,
  ],
  controllers: [SuggestionController],
})
export class SuggestionModule {}
