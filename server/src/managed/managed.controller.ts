import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Account, Category } from '../database/schema';
import { NameDto } from './managed.dto';
import { ManagedService, type TagWithCount } from './managed.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Category[]> {
    return this.managedService.listCategories(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: NameDto,
  ): Promise<Category> {
    return this.managedService.createCategory(userId, body.name);
  }

  @Patch(':id')
  rename(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NameDto,
  ): Promise<Category> {
    return this.managedService.renameCategory(userId, id, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.managedService.deleteCategory(userId, id);
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Account[]> {
    return this.managedService.listAccounts(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: NameDto,
  ): Promise<Account> {
    return this.managedService.createAccount(userId, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.managedService.deleteAccount(userId, id);
  }
}

@Controller('tags')
export class TagsController {
  constructor(private readonly managedService: ManagedService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<TagWithCount[]> {
    return this.managedService.listTags(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: NameDto,
  ): Promise<{ name: string }> {
    return this.managedService.createTag(userId, body.name);
  }

  @Delete(':name')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('name') name: string,
  ): Promise<void> {
    await this.managedService.deleteTag(userId, name);
  }
}
