import { Module } from '@nestjs/common';
import { FranchiseDocumentsController } from './franchise-documents.controller';
import { FranchiseDocumentsService } from './franchise-documents.service';

@Module({
  controllers: [FranchiseDocumentsController],
  providers: [FranchiseDocumentsService],
})
export class FranchiseDocumentsModule {}
