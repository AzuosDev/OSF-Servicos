import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user._id.toString(), dto);
  }

  @Get()
  async findAll(@CurrentUser() user: ICurrentUser, @Query('activeOnly') activeOnly?: string) {
    return this.servicesService.findAll(user._id.toString(), activeOnly === 'true');
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.servicesService.findOne(user._id.toString(), id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: ICurrentUser, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(user._id.toString(), id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.servicesService.remove(user._id.toString(), id);
  }
}
