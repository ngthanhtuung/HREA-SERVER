import { OmitType } from '@nestjs/swagger';
import { messaging } from 'firebase-admin';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CustomerContactEntity } from './customer_contacts.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CustomerContactRequest,
  FilterCustomerContact,
  RejectNote,
} from './dto/contact.dto';
import { CustomerContactPagination } from './dto/contact.pagination';
import { IPaginateResponse, paginateResponse } from '../base/filter.pagination';
import { EContactInformation, ERole } from 'src/common/enum/enum';
import { UserEntity } from '../user/user.entity';
import * as moment from 'moment-timezone';
import { UserService } from '../user/user.service';

@Injectable()
export class CustomerContactsService {
  constructor(
    @InjectRepository(CustomerContactEntity)
    private readonly customerContactRepository: Repository<CustomerContactEntity>,
    private userService: UserService,
  ) {}

  private generalBuilderContacts(): SelectQueryBuilder<CustomerContactEntity> {
    return this.customerContactRepository.createQueryBuilder('contacts');
  }

  async getAllContacts(
    contactPagination: CustomerContactPagination,
    filter: FilterCustomerContact,
    user: UserEntity,
  ): Promise<IPaginateResponse<unknown> | undefined> {
    console.log('User Login: ', user);
    try {
      const { currentPage, sizePage } = contactPagination;
      const { sortProperty, sort, status } = filter;
      const query = this.generalBuilderContacts();
      query.select([
        'contacts.id as id',
        'contacts.fullName as fullName',
        'contacts.email as email',
        'contacts.phoneNumber as phoneNumber',
        'contacts.note as note',
        'contacts.processedBy as processedBy',
        'contacts.createdAt as createdAt',
        'contacts.status as status',
      ]);
      if (
        user.role.toString() !== ERole.ADMIN &&
        status !== EContactInformation.PENDING
      ) {
        console.log('Code is running here!');
        query.where('contacts.processedBy = :userId', { userId: user.id });
      }
      if (status) {
        query.andWhere('contacts.status = :status', { status });
      }
      if (sortProperty) {
        query.orderBy(`contacts.${sortProperty}`, sort);
      }
      const [result, total] = await Promise.all([
        query
          .offset((sizePage as number) * ((currentPage as number) - 1))
          .limit(sizePage as number)
          .execute(),
        query.getCount(),
      ]);
      const contactsWithUserDetails = await Promise.all(
        result.map(async (contact) => {
          if (contact.processedBy) {
            const userDetails = await this.userService.findByIdV2(
              contact.processedBy,
            );
            const processedBy = {
              id: userDetails.id,
              fullName: userDetails.fullName,
              email: userDetails.email,
              phoneNumber: userDetails.phoneNumber,
              dob: userDetails.dob,
              avatar: userDetails.avatar,
              status: userDetails.status,
            };
            return { ...contact, processedBy }; // Merge contact and user details
          }
          return contact;
        }),
      );
      return paginateResponse<unknown>(
        [contactsWithUserDetails, total],
        currentPage as number,
        sizePage as number,
      );
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }
  async leaveMessage(
    contact: CustomerContactRequest,
  ): Promise<string | undefined> {
    try {
      const data = await this.customerContactRepository.save({
        fullName: contact.fullName,
        email: contact.email,
        phoneNumber: contact.phoneNumber,
        note: contact.note,
      });
      if (data) {
        return 'Leave message successfully';
      }
      throw new BadRequestException('Error unknown');
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateStatus(
    user: UserEntity,
    contactId: string,
    status: EContactInformation,
    rejectNote: RejectNote,
  ): Promise<string | undefined> {
    try {
      const contactExisted = await this.customerContactRepository.findOne({
        where: { id: contactId },
      });
      if (
        contactExisted &&
        contactExisted.status === EContactInformation.PENDING
      ) {
        switch (status) {
          case EContactInformation.ACCEPT:
            if (
              contactExisted.status !== EContactInformation.PENDING &&
              user.role.toString() === ERole.ADMIN
            ) {
              throw new BadRequestException(
                'This contact can not be accepted because you are admin or contact is already!',
              );
            }
            const acceptedResult = await this.customerContactRepository.update(
              { id: contactId },
              {
                status: status,
                processedBy: user.id,
                updateAt: moment()
                  .tz('Asia/Ho_Chi_Minh')
                  .format('YYYY-MM-DD HH:mm:ss'),
                updatedBy: user.id,
              },
            );
            if (acceptedResult) {
              return `Accept contact of ${contactExisted.fullName} - ${contactExisted.phoneNumber} successfully. Processed by: ${user.id}`;
            } else {
              throw new BadRequestException('Error unknown');
            }
            break;
          case EContactInformation.REJECT:
            if (
              user.role.toString() !== ERole.ADMIN &&
              contactExisted.processedBy !== user.id
            ) {
              throw new BadRequestException(
                `You are not allowed to reject contact [${contactExisted.id}] - ${contactExisted.fullName} - ${contactExisted.phoneNumber}`,
              );
            }
            const rejectResult = await this.customerContactRepository.update(
              { id: contactId },
              {
                status: status,
                processedBy: user.id,
                updateAt: moment()
                  .tz('Asia/Ho_Chi_Minh')
                  .format('YYYY-MM-DD HH:mm:ss'),
                updatedBy: user.id,
                rejectNote: rejectNote.rejectNote,
              },
            );
            if (rejectResult) {
              return `Reject contact of ${contactExisted.fullName} - ${contactExisted.phoneNumber} successfully.\n
              The reason reject: ${rejectNote.rejectNote}`;
            } else {
              throw new BadRequestException('Error unknown');
            }
            break;
        }
      }
      throw new NotFoundException(
        `Contact ${contactId} not found or process already, try again!`,
      );
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }
}