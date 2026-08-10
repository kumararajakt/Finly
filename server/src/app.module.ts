import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CountriesModule } from './countries/countries.module';
import { DatabaseModule } from './database/database.module';
import { DetectionModule } from './detection/detection.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { ManagedModule } from './managed/managed.module';
import { RecurringModule } from './recurring/recurring.module';
import { RulesModule } from './rules/rules.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SummaryModule } from './summary/summary.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    CountriesModule,
    HealthModule,
    ImportModule,
    ManagedModule,
    SettingsModule,
    SummaryModule,
    TransactionsModule,
    RecurringModule,
    SubscriptionsModule,
    BudgetsModule,
    GoalsModule,
    RulesModule,
    DetectionModule,
  ],
})
export class AppModule {}
