import { Module } from '@nestjs/common';
import { CustomerContactsService } from './customer_contacts.service';
import { CustomerContactsController } from './customer_contacts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerContactEntity } from './customer_contacts.entity';
import { UserModule } from '../user/user.module';
import { EventTypesModule } from '../event_types/event_types.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerContactEntity]),
    UserModule,
    EventTypesModule,
  ],
  providers: [CustomerContactsService],
  controllers: [CustomerContactsController],
  exports: [CustomerContactsService],
})
export class CustomerContactsModule {}
