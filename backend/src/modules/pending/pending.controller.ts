import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query, UseGuards, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PendingService } from './pending.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreatePendingDto } from './dto/create-pending.dto';
import { UpdatePendingDto } from './dto/update-pending.dto';

@ApiTags('Pending')
@ApiBearerAuth()
@Controller('api/pending')
@UseGuards(JwtAuthGuard)
export class PendingController {
  constructor(private pendingService: PendingService) {}

  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreatePendingDto) {
    return this.pendingService.create(user._id.toString(), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: ICurrentUser,
    @Query('paid') paid?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const paidFilter = paid === 'true' ? true : paid === 'false' ? false : undefined;
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.pendingService.findAll(user._id.toString(), monthNum, yearNum, paidFilter);
  }

  @Post(':templateId/pay-month')
  @HttpCode(200)
  async payMonth(
    @CurrentUser() user: ICurrentUser,
    @Param('templateId') templateId: string,
    @Body('month') month: number,
    @Body('year') year: number,
  ) {
    return this.pendingService.payRecurringInstance(user._id.toString(), templateId, month, year);
  }

  @Patch(':id')
  async update(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Body() dto: UpdatePendingDto) {
    return this.pendingService.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.pendingService.remove(user._id.toString(), id);
  }

  @Delete('group/:grupoParceladoId')
  async removeGroup(@CurrentUser() user: ICurrentUser, @Param('grupoParceladoId') grupoParceladoId: string) {
    return this.pendingService.removeGroup(user._id.toString(), grupoParceladoId);
  }
}
