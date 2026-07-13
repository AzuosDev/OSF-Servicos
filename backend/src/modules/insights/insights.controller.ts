import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { InsightsService } from './insights.service';
import { GetAnnualSummaryDto } from './dto/get-annual-summary.dto';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/insights')
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Throttle(5, 60)
  @Get('annual-summary')
  async getAnnualSummary(@CurrentUser() user: ICurrentUser, @Query() query: GetAnnualSummaryDto) {
    const year = query.year ?? new Date().getFullYear();
    return this.insightsService.getAnnualSummary(user._id.toString(), year);
  }
}
