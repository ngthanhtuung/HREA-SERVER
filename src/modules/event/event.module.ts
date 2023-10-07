import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { AssignEventModule } from '../assign-event/assign-event.module';

@Module({
  imports: [AssignEventModule, TypeOrmModule.forFeature([EventEntity])],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}