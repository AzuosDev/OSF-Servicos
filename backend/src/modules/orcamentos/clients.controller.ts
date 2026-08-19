import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Orçamentos - Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/orcamentos/clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user._id.toString(), dto);
  }

  @Get()
  async findAll(@CurrentUser() user: ICurrentUser, @Query('activeOnly') activeOnly?: string) {
    return this.clientsService.findAll(user._id.toString(), activeOnly === 'true');
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.clientsService.findOne(user._id.toString(), id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.clientsService.remove(user._id.toString(), id);
  }
}
