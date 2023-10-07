import { EventPagination } from './dto/event.pagination';
import { Body, Controller, Get, Param, Post, Query, Put } from '@nestjs/common';
import { EventService } from './event.service';
import { IPaginateResponse } from '../base/filter.pagination';
import { EventResponse } from './dto/event.response';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  EventAssignRequest,
  EventCreateRequest,
  EventUpdateRequest,
} from './dto/event.request';
import { EEventStatus, ERole } from 'src/common/enum/enum';
import { Roles } from 'src/decorators/role.decorator';
import { GetUser } from 'src/decorators/getUser.decorator';

@Controller('event')
@ApiBearerAuth()
@ApiTags('event-controller')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  /**
   * getAllEventByDivisionID
   * @param data
   */

  @Get('/division')
  @Roles(ERole.STAFF, ERole.EMPLOYEE)
  async getAllEventByDivisionID(
    @GetUser() user: string,
  ): Promise<Array<EventResponse>> {
    return await this.eventService.getAllEventByDivisionID(
      JSON.parse(user).divisionId,
    );
  }

  /**
   * getAllEvent
   * @param eventPagination
   * @returns
   */
  @Get()
  @Roles(ERole.MANAGER)
  async getAllEvent(
    @Query() eventPagination: EventPagination,
  ): Promise<IPaginateResponse<EventResponse>> {
    return await this.eventService.getAllEvent(eventPagination);
  }

  /**
   * getEventById
   * @param data
   */

  @Get('/:eventId')
  @Roles(ERole.MANAGER, ERole.STAFF, ERole.EMPLOYEE)
  async getEventById(@Param('eventId') id: string): Promise<EventResponse> {
    return await this.eventService.getEventById(id);
  }

  /**
   * createEvent
   * @param data
   */
  @Post()
  @Roles(ERole.MANAGER)
  async createEvent(
    @Body() data: EventCreateRequest,
  ): Promise<string | undefined> {
    return await this.eventService.createEvent(data);
  }

  /**
   * createEvent
   * @param data
   */
  @Put()
  @Roles(ERole.MANAGER)
  async updateEvent(
    @Body() data: EventUpdateRequest,
  ): Promise<string | undefined> {
    return await this.eventService.updateEvent(data);
  }

  /**
   *  assignDivisionIntoEvent
   * @param data
   */
  @Put('/edit-division')
  @Roles(ERole.MANAGER)
  async editDivisionIntoEvent(
    @Body() data: EventAssignRequest,
  ): Promise<string | undefined> {
    return await this.eventService.editDivisionIntoEvent(data);
  }

  @Put('/:eventId/:status')
  @Roles(ERole.MANAGER)
  @ApiParam({ name: 'status', enum: EEventStatus })
  async updateEventStatus(
    @Param('eventId') eventId: string,
    @Param('status') status: EEventStatus,
  ): Promise<string> {
    return await this.eventService.updateEventStatus(eventId, status);
  }
}