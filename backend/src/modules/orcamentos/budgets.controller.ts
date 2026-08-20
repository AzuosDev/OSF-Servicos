import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BudgetsService } from './budgets.service';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { GetBudgetsDto } from './dto/get-budgets.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@ApiTags('Orçamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/orcamentos/budgets')
export class BudgetsController {
  constructor(
    private budgetsService: BudgetsService,
    private pdfService: PdfService,
  ) {}

  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(user._id.toString(), dto);
  }

  @Get()
  async findAll(@CurrentUser() user: ICurrentUser, @Query() query: GetBudgetsDto) {
    return this.budgetsService.findAll(user._id.toString(), query);
  }

  @Get('stats/conversion')
  async conversionStats(
    @CurrentUser() user: ICurrentUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.budgetsService.getConversionStats(user._id.toString(), from, to);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.budgetsService.findOne(user._id.toString(), id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetStatusDto,
  ) {
    return this.budgetsService.updateStatus(user._id.toString(), id, dto);
  }

  // Declarado depois de ':id/status' para que a rota mais específica seja resolvida primeiro.
  @Patch(':id')
  async update(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(user._id.toString(), id, dto);
  }

  @Get(':id/pdf')
  async pdf(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.pdfService.generateBudgetPdf(user._id.toString(), id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}.pdf"`);
    res.send(buffer);
  }
}
