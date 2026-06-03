import { Body, Controller, Delete, Get, Patch, Post, UseGuards, Param } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Controller('api/goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.goalsService.findAll(user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(user._id.toString(), id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.remove(user._id.toString(), id);
  }
}
