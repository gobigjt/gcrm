import { Module }               from '@nestjs/common';
import { LeadsController }      from './leads.controller';
import { LeadsService }         from './leads.service';
import { LeadCaptureController} from './lead-capture.controller';
import { DatabaseModule }       from '../../database/database.module';

@Module({
  imports:     [DatabaseModule],
  controllers: [LeadsController, LeadCaptureController],
  providers:   [LeadsService],
})
export class CrmModule {}
