import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgendaReportsService } from './agenda-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { GetDailySummaryDto } from './dto/get-daily-summary.dto';

@ApiTags('Agenda Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/agenda-reports')
export class AgendaReportsController {
  constructor(private agendaReportsService: AgendaReportsService) {}

  @Get('daily-summary')
  async getDailySummary(@CurrentUser() user: ICurrentUser, @Query() query: GetDailySummaryDto) {
    return this.agendaReportsService.getDailySummary(user._id.toString(), query.date);
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: ICurrentUser) {
    return this.agendaReportsService.getDashboard(user._id.toString());
  }
}
