import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DistanceService } from './distance.service';
import { CompanySettingsService } from './company-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CalculateDistanceDto } from './dto/calculate-distance.dto';

@ApiTags('Orçamentos - Deslocamento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/orcamentos/distance')
export class DistanceController {
  constructor(
    private distanceService: DistanceService,
    private companySettingsService: CompanySettingsService,
  ) {}

  @Throttle(10, 60)
  @Post('calculate')
  async calculate(@CurrentUser() user: ICurrentUser, @Body() dto: CalculateDistanceDto) {
    const userId = user._id.toString();
    const settings = await this.companySettingsService.get(userId);
    return this.distanceService.calculate(userId, settings.baseAddress, dto.destinationAddress, {
      pricePerKm: settings.pricePerKm,
      minimumTravelFee: settings.minimumTravelFee,
      freeRadiusKm: settings.freeRadiusKm,
    });
  }
}
