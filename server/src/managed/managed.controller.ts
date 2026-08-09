import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import type { Account, Category } from '../database/schema';
import { NameDto } from './managed.dto';
import { ManagedService, type TagWithCount } from './managed.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(): Promise<Category[]> {
    return this.managedService.listCategories();
  }

  @Post()
  create(@Body() body: NameDto): Promise<Category> {
    return this.managedService.createCategory(body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.managedService.deleteCategory(id);
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(): Promise<Account[]> {
    return this.managedService.listAccounts();
  }

  @Post()
  create(@Body() body: NameDto): Promise<Account> {
    return this.managedService.createAccount(body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.managedService.deleteAccount(id);
  }
}

@Controller('tags')
export class TagsController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(): Promise<TagWithCount[]> {
    return this.managedService.listTags();
  }

  @Post()
  create(@Body() body: NameDto): Promise<{ name: string }> {
    return this.managedService.createTag(body.name);
  }

  @Delete(':name')
  @HttpCode(204)
  async remove(@Param('name') name: string): Promise<void> {
    await this.managedService.deleteTag(name);
  }
}
