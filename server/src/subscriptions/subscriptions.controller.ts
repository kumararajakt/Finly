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
import type { Subscription } from '../database/schema';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './subscriptions.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Subscription[]> {
    return this.subscriptionsService.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateSubscriptionDto,
  ): Promise<Subscription> {
    return this.subscriptionsService.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    return this.subscriptionsService.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.subscriptionsService.remove(userId, id);
  }
}
