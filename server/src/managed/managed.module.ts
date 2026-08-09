import { Module } from '@nestjs/common';
import {
  AccountsController,
  CategoriesController,
  TagsController,
} from './managed.controller';
import { ManagedService } from './managed.service';

@Module({
  controllers: [CategoriesController, AccountsController, TagsController],
  providers: [ManagedService],
})
export class ManagedModule {}
