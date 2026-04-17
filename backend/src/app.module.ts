import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule }     from './database/database.module';
import { AuditModule }        from './modules/audit/audit.module';
import { RedisModule }        from './redis/redis.module';
import { AuthModule }         from './modules/auth/auth.module';
import { UsersModule }        from './modules/users/users.module';
import { CrmModule }          from './modules/crm/crm.module';
import { SalesModule }        from './modules/sales/sales.module';
import { PurchaseModule }     from './modules/purchase/purchase.module';
import { InventoryModule }    from './modules/inventory/inventory.module';
import { ProductionModule }   from './modules/production/production.module';
import { FinanceModule }      from './modules/finance/finance.module';
import { HrModule }           from './modules/hr/hr.module';
import { CommunicationModule} from './modules/communication/communication.module';
import { SettingsModule }       from './modules/settings/settings.module';
import { ExportModule }         from './modules/export/export.module';
import { NotificationsModule }  from './modules/notifications/notifications.module';
import { TenantsModule }        from './modules/tenants/tenants.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CrmModule,
    SalesModule,
    PurchaseModule,
    InventoryModule,
    ProductionModule,
    FinanceModule,
    HrModule,
    CommunicationModule,
    SettingsModule,
    ExportModule,
    NotificationsModule,
    TenantsModule,
  ],
})
export class AppModule {}
