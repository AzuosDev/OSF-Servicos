import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards, Post } from '@nestjs/common';
import { PendingService } from './pending.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePendingDto } from './dto/create-pending.dto';
import { UpdatePendingDto } from './dto/update-pending.dto';

@Controller('api/pending')
export class PendingController {
  constructor(private pendingService: PendingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreatePendingDto) {
    return this.pendingService.create(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any, @Query('paid') paid?: string) {
    const paidFilter = paid === 'true' ? true : paid === 'false' ? false : undefined;
    return this.pendingService.findAll(user._id.toString(), paidFilter);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdatePendingDto) {
    return this.pendingService.update(user._id.toString(), id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pendingService.remove(user._id.toString(), id);
  }
}
