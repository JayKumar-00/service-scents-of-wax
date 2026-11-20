import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SmartSearchService } from './elastic-search/services/smart-search.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const searchService = app.get(SmartSearchService);

  console.log('Testing Auto-Complete Suggestions with query "z":');
  const result1 = await searchService.autoCompleteSuggestions({
    autoComplete: 'z',
  });
  console.log(JSON.stringify(result1, null, 2));

  console.log('\nTesting Auto-Complete Suggestions with query "h":');
  const result2 = await searchService.autoCompleteSuggestions({
    autoComplete: 'h',
  });
  console.log(JSON.stringify(result2, null, 2));

  console.log('\nTesting Auto-Complete Suggestions with query "abac":');
  const result3 = await searchService.autoCompleteSuggestions({
    autoComplete: 'abac',
  });
  console.log(JSON.stringify(result3, null, 2));

  console.log(
    '\nTesting Auto-Complete Suggestions with query "abcdefghijklmnopqrstuvwxyz":',
  );
  const result4 = await searchService.autoCompleteSuggestions({
    autoComplete: 'abcdefghijklmnopqrstuvwxyz',
  });
  console.log(JSON.stringify(result4, null, 2));

  await app.close();
}

bootstrap().catch(console.error);
