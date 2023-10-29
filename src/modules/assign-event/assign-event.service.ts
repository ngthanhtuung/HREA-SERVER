import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseService } from '../base/base.service';
import { AssignEventEntity } from './assign-event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import AssignEventRepository from './assign-event.repository';
import { SelectQueryBuilder } from 'typeorm';
import { EventResponse } from '../event/dto/event.response';
import { ERole } from 'src/common/enum/enum';

@Injectable()
export class AssignEventService extends BaseService<AssignEventEntity> {
  constructor(
    @InjectRepository(AssignEventEntity)
    private readonly assignEventRepository: AssignEventRepository,
  ) {
    super(assignEventRepository);
  }

  generalBuilderAssignEvent(): SelectQueryBuilder<AssignEventEntity> {
    return this.assignEventRepository.createQueryBuilder('assign_events');
  }

  /**
   * getEventByDivisionID
   * @param id
   * @returns
   */
  async getEventByDivisionID(id: string): Promise<Array<EventResponse>> {
    try {
      const query = this.generalBuilderAssignEvent();
      query.leftJoin('events', 'events', 'assign_events.eventId = events.id');
      query.select([
        'events.id as id',
        'events.eventName as eventName',
        'events.description as description',
        'events.coverUrl as coverUrl',
        'events.startDate as startDate',
        'events.endDate as endDate',
        'events.location as location',
        'events.estBudget as estBudget',
        'events.createdAt as createdAt',
        'events.updatedAt as updatedAt',
        'events.status as status',
      ]);
      query.where('assign_events.divisionId = :divisionId', {
        divisionId: id,
      });
      const data = await query.execute();
      return data;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getListStaffDivisionByEventID
   * @param id
   * @returns
   */
  async getListStaffDivisionByEventID(
    id: string,
  ): Promise<Array<EventResponse>> {
    try {
      const query = this.generalBuilderAssignEvent();
      query.leftJoin(
        'divisions',
        'divisions',
        'assign_events.divisionId = divisions.id',
      );
      query.leftJoin('users', 'users', 'divisions.id = users.divisionId');
      query.leftJoin('profiles', 'profiles', 'users.id = profiles.profileId');
      query.select([
        'divisions.id as divisionId',
        'divisions.divisionName as divisionName',
        'users.id as userId',
        'profiles.fullName as fullName',
        'profiles.avatar as avatar',
      ]);
      query.where('profiles.role = :role', {
        role: ERole.STAFF,
      });
      query.andWhere('assign_events.eventId = :eventId', {
        eventId: id,
      });
      const data = await query.execute();
      return data;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getListStaffDivisionAllEvent
   * @returns
   */
  async getListStaffDivisionAllEvent(): Promise<unknown> {
    try {
      const query = this.generalBuilderAssignEvent();
      query.leftJoin(
        'divisions',
        'divisions',
        'assign_events.divisionId = divisions.id',
      );
      query.leftJoin('users', 'users', 'divisions.id = users.divisionId');
      query.leftJoin('profiles', 'profiles', 'users.id = profiles.profileId');
      query.select([
        'assign_events.eventId as eventId',
        'divisions.id as divisionId',
        'divisions.divisionName as divisionName',
        'users.id as userId',
        'profiles.fullName as fullName',
        'profiles.avatar as avatar',
      ]);
      query.where('profiles.role = :role', {
        role: ERole.STAFF,
      });
      const data = await query.execute();
      const mappedArray = {};
      data.forEach((item) => {
        if (!mappedArray[item.eventId]) {
          mappedArray[item.eventId] = [];
        }
        mappedArray[item.eventId].push({
          divisionId: item.divisionId,
          divisionName: item.divisionName,
          userId: item.userId,
          fullName: item.fullName,
          avatar: item.avatar,
        });
      });
      return mappedArray;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }
}
