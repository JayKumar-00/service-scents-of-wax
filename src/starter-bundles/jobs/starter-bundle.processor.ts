import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { BundleProvisionService } from '../bundle-provision.service';

@Injectable()
@Processor('starter-bundle')
export class StarterBundleProcessor extends WorkerHost {
  private readonly logger = new Logger(StarterBundleProcessor.name);

  constructor(private readonly provisionService: BundleProvisionService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const eventName = job.name;
    const data = job.data;

    if (eventName === 'provision-franchise-bundle') {
      this.logger.log(`Starting starter bundle provisioning for assignment ${data.assignmentId}`);
      try {
        await this.provisionService.provisionBundle(
          data.assignmentId,
          data.actorUserId,
          data.ip
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to process starter bundle provisioning job: ${err.message}`,
          err.stack,
        );
        throw err;
      }
    }
  }
}
