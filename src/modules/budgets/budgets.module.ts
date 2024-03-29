import { Module, forwardRef } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './transactions.entity';
import { TaskModule } from '../task/task.module';
import { SharedModule } from '../../shared/shared.module';
import { BudgetsController } from './budgets.controller';
import { UserModule } from '../user/user.module';
import { FileModule } from '../../file/file.module';
import { TransactionEvidenceEntity } from './transaction_evidence.entity';
import { NotificationModule } from '../notification/notification.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, TransactionEvidenceEntity]),
    TaskModule,
    SharedModule,
    UserModule,
    FileModule,
    NotificationModule,
    forwardRef(() => ItemsModule),
  ],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService],
})
export class BudgetsModule {}
