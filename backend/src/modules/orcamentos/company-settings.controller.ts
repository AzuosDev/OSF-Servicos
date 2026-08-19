import { Body, Controller, Get, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CompanySettingsService } from './company-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CompanySettingsDto } from './dto/company-settings.dto';

@ApiTags('Orçamentos - Empresa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/orcamentos/company-settings')
export class CompanySettingsController {
  constructor(private companySettingsService: CompanySettingsService) {}

  @Get()
  async get(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    const settings = await this.companySettingsService.findRaw(user._id.toString());
    // Nest trata `null`/`undefined` retornados de um handler como "sem corpo" e não envia
    // o JSON `null` de verdade — usamos @Res() para responder o null explicitamente, já que
    // o frontend depende de distinguir "configurado" (objeto) de "não configurado" (null).
    res.status(200).json(settings);
  }

  @Put()
  async upsert(@CurrentUser() user: ICurrentUser, @Body() dto: CompanySettingsDto) {
    return this.companySettingsService.upsert(user._id.toString(), dto);
  }
}
