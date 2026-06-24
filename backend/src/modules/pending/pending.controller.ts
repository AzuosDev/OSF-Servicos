import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards, Post } from '@nestjs/common';
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
export class PendingController {
  constructor(private pendingService: PendingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreatePendingDto) {
    return this.pendingService.create(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: ICurrentUser, @Query('paid') paid?: string) {
    const paidFilter = paid === 'true' ? true : paid === 'false' ? false : undefined;
    return this.pendingService.findAll(user._id.toString(), paidFilter);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Body() dto: UpdatePendingDto) {
    return this.pendingService.update(user._id.toString(), id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.pendingService.remove(user._id.toString(), id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('group/:grupoParceladoId')
  async removeGroup(@CurrentUser() user: ICurrentUser, @Param('grupoParceladoId') grupoParceladoId: string) {
    return this.pendingService.removeGroup(user._id.toString(), grupoParceladoId);
  }
}
