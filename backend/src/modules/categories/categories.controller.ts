import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('api/categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(@CurrentUser() user: ICurrentUser, @Query('income') income?: string) {
    return this.categoriesService.findAll(user._id.toString(), income === 'true' ? true : income === 'false' ? false : undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.categoriesService.remove(user._id.toString(), id);
  }
}
