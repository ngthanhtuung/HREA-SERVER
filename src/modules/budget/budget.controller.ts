import { BudgetService } from './budget.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Delete,
} from '@nestjs/common';
import {
  BudgetsCreateRequest,
  BudgetsUpdateRequest,
} from './dto/budgets.request';
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/decorators/getUser.decorator';
import { BudgetsPagination } from './dto/budgets.pagination';
import { IPaginateResponse } from '../base/filter.pagination';
import { BudgetsResponse } from './dto/budgets.response';
import { ERole, EStatusBudgets } from 'src/common/enum/enum';
import { Roles } from 'src/decorators/role.decorator';
@Controller('budget')
@ApiBearerAuth()
@ApiTags('Budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  /**
   * getAllBudgetsByEvent
   * @param eventID
   * @param budgetPagination
   * @param mode
   * @param userID
   * @returns
   */
  @ApiQuery({
    name: 'userID',
    required: false,
  })
  @Get('/:eventID')
  async getAllBudgetsByEvent(
    @Param('eventID') eventID: string,
    @Query() budgetPagination: BudgetsPagination,
    @Query('mode') mode: number,
    @Query('userID') userID: string,
  ): Promise<IPaginateResponse<BudgetsResponse[]>> {
    return await this.budgetService.getAllBudgetsByEventID(
      budgetPagination,
      eventID,
      mode,
      userID,
    );
  }

  /**
   * getAllBudgetsByEvent
   * @param budgetID
   * @returns
   */

  @Get('detail/:budgetID')
  async getBudgetDetail(
    @Param('budgetID') budgetID: string,
  ): Promise<BudgetsResponse> {
    return await this.budgetService.getBudgetById(budgetID);
  }

  /**
   * getAllBudgetsByEvent
   * @param budgetID
   * @returns
   */

  @Delete('detail/:budgetID')
  async deleteBudgets(@Param('budgetID') budgetID: string): Promise<string> {
    return await this.budgetService.deleteBudgets(budgetID);
  }

  /**
   * createEvent
   * @param data
   */
  @Post()
  async createBudgetRequest(
    @Body() data: BudgetsCreateRequest,
    @GetUser() user: string,
  ): Promise<string | undefined> {
    return await this.budgetService.createBudgetRequest(data, user);
  }

  /**
   * updateBudget
   * @param data
   */
  @Put('/:budgetsId')
  @Roles(ERole.MANAGER, ERole.STAFF)
  async updateBudget(
    @Param('budgetsId') budgetId: string,
    @GetUser() user: string,
    @Body() data: BudgetsUpdateRequest,
  ): Promise<string | undefined> {
    return await this.budgetService.updateBudget(budgetId, data, user);
  }

  /**
   * updateBudgetStatus
   * @param budgetId
   * @param status
   */
  @Put('/:budgetsId/:status')
  @Roles(ERole.MANAGER)
  @ApiParam({ name: 'status', enum: EStatusBudgets })
  async updateBudgetStatus(
    @Param('budgetsId') budgetId: string,
    @Param('status') status: EStatusBudgets,
    @GetUser() user: string,
  ): Promise<string | undefined> {
    return await this.budgetService.updateBudgetStatus(budgetId, status, user);
  }
}
