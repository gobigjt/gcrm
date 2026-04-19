import { Module }             from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService }    from './settings.service';
import { ObjectStorageService } from '../../common/services/object-storage.service';

@Module({ controllers: [SettingsController], providers: [SettingsService, ObjectStorageService] })
export class SettingsModule {}
