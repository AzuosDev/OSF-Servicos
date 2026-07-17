import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgendaService } from './agenda.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';

@ApiTags('Agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/appointments')
export class AgendaController {
  constructor(private agendaService: AgendaService) {}

  @Get()
  async findAll(@CurrentUser() user: ICurrentUser, @Query('date') date?: string) {
    return this.agendaService.findAll(user._id.toString(), date);
  }

  @Get('availability')
  async getAvailability(
    @CurrentUser() user: ICurrentUser,
    @Query('date') date: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    return this.agendaService.getAvailability(
      user._id.toString(),
      date,
      durationMinutes ? Number(durationMinutes) : undefined,
    );
  }

  @Get('accounts-receivable')
  async findAccountsReceivable(@CurrentUser() user: ICurrentUser) {
    return this.agendaService.findAccountsReceivable(user._id.toString());
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.agendaService.findOne(user._id.toString(), id);
  }

  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateAppointmentDto) {
    return this.agendaService.create(user._id.toString(), dto);
  }

  @Patch(':id')
  async update(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.agendaService.update(user._id.toString(), id, dto);
  }

  @Patch(':id/reschedule')
  async reschedule(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.agendaService.reschedule(user._id.toString(), id, dto);
  }

  @Patch(':id/cancel')
  async cancel(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.agendaService.cancel(user._id.toString(), id);
  }

  @Patch(':id/finish')
  async finish(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.agendaService.finish(user._id.toString(), id);
  }

  @Post(':id/payments')
  async registerPayment(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.agendaService.registerPayment(user._id.toString(), id, dto);
  }
}
