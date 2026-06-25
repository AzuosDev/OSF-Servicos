import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ICurrentUser } from '../../common/types/current-user.type';
import { GetExpensesDto } from './dto/get-expenses.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('api/expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getExpenses(@CurrentUser() user: ICurrentUser, @Query() query: GetExpensesDto) {
    return this.expensesService.getExpenses(user._id.toString(), query.period);
  }
}
