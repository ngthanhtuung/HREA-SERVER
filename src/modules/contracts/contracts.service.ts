/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ContractRejectNote,
  FilterContract,
  UpdateContractInfo,
} from './dto/contract.dto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ContractEntity } from './contracts.entity';
import { BaseService } from '../base/base.service';
import {
  DataSource,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../user/user.entity';
import * as admin from 'firebase-admin';
import * as Docxtemplater from 'docxtemplater';
import * as PizZip from 'pizzip';
import { SharedService } from 'src/shared/shared.service';
import {
  EContactInformation,
  EContractEvidenceType,
  EContractStatus,
  ERole,
  ETypeNotification,
} from 'src/common/enum/enum';
import { UserService } from '../user/user.service';
import { IPaginateResponse, paginateResponse } from '../base/filter.pagination';
import { ContractPagination } from './dto/contract.pagination';
import { FileRequest } from 'src/file/dto/file.request';
import { FileService } from 'src/file/file.service';
import { ContractEvidenceEntity } from './contract_evidence.entity';
import * as moment from 'moment-timezone';
import * as libre from 'libreoffice-convert';
import { EventCreateRequestContract } from '../event/dto/event.request';
import { ItemsService } from '../items/items.service';
import { ContractFileEntity } from './contract_files.entity';
import { CustomerContactEntity } from '../customer_contacts/customer_contacts.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationContractRequest } from '../notification/dto/notification.request';
import { CustomerContactsService } from '../customer_contacts/customer_contacts.service';

@Injectable()
export class ContractsService extends BaseService<ContractEntity> {
  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractRepository: Repository<ContractEntity>,
    @InjectRepository(ContractEvidenceEntity)
    private readonly contractEvidenceEntity: Repository<ContractEvidenceEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly sharedService: SharedService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
    private readonly planService: ItemsService,
    private readonly customerContactsService: CustomerContactsService,
    private readonly notificationService: NotificationService,
  ) {
    super(contractRepository);
  }

  /**
   * findContact
   * @param contactId
   * @returns
   */
  async findContact(contactId: string) {
    return await this.customerContactsService.findContactById(contactId);
  }

  /**
   * uploadContractFile
   * @param buf
   * @param contractCode
   * @returns
   */
  async uploadContractFile(buf: Buffer, contractCode: string) {
    const fileName = `${contractCode}.pdf`;
    const download = await this.uploadFile(buf, fileName);
    return download;
  }

  /**
   * createContract
   * @param queryRunner
   * @param customerInfo
   * @param contactId
   * @param user
   * @returns
   */
  async createContract(
    queryRunner: QueryRunner,
    customerInfo: EventCreateRequestContract,
    contactId: string,
    user: UserEntity,
  ) {
    const contract = await queryRunner.manager.insert(ContractEntity, {
      customerName: customerInfo.customerName,
      customerNationalId: customerInfo.customerNationalId,
      customerAddress: customerInfo.customerAddress,
      customerEmail: customerInfo.customerEmail,
      customerPhoneNumber: customerInfo.customerPhoneNumber,
      companyRepresentative: user.id,
      createdBy: user.id,
      paymentMethod: customerInfo.paymentMethod,
      eventName: customerInfo.eventName,
      startDate: customerInfo.startDate,
      processingDate: customerInfo.processingDate,
      endDate: customerInfo.endDate,
      location: customerInfo.location,
      paymentDate: customerInfo.paymentDate,
      customerContact: {
        id: contactId,
      },
    });
    return contract?.generatedMaps[0]['id'];
  }

  /**
   * createContractFile
   * @param queryRunner
   * @param contractCode
   * @param buf
   * @param download
   * @param contractId
   */
  async createContractFile(
    queryRunner: QueryRunner,
    contractCode: string,
    buf: Buffer,
    download: any,
    contractId: string,
  ) {
    await queryRunner.manager.insert(ContractFileEntity, {
      contractCode: contractCode,
      contractFileName: `${contractCode}.pdf`,
      contractFileSize: buf.length,
      contractFileUrl: download?.['downloadUrl'],
      contract: {
        id: contractId,
      },
    });
  }

  /**
   * sendContractAlert
   * @param user
   * @param customerInfo
   * @param contractCode
   */
  async sendContractAlert(
    user: UserEntity,
    customerInfo: EventCreateRequestContract,
    contractCode: string,
  ) {
    const userProcess = await this.userService.findByIdV2(user.id);
    await this.sharedService.sendContractAlert(
      customerInfo.customerEmail,
      customerInfo.customerName,
      contractCode,
      userProcess.fullName,
      userProcess.email,
      userProcess.phoneNumber,
    );
  }

  /**
   * generateNewContract
   * @param customerInfo
   * @param contactId
   * @param user
   * @returns
   */
  async generateNewContract(
    customerInfo: EventCreateRequestContract,
    contactId: string,
    user: UserEntity,
  ): Promise<object | undefined> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      // Get Information of Contact
      const contactExisted = await this.findContact(contactId);
      const contractCode = this.sharedService.generateContractCode();
      // Generate Contract Docs
      const buf = await this.generateContractDocs(
        customerInfo,
        contactId,
        user,
      );
      if (!buf) return undefined;
      // Upload Contract File
      const downloadObject = await this.uploadContractFile(buf, contractCode);
      let contractId = contactExisted?.contract?.id;
      if (!contactExisted.contract) {
        contractId = await this.createContract(
          queryRunner,
          customerInfo,
          contactId,
          user,
        );
      }
      await Promise.all([
        this.createContractFile(
          queryRunner,
          contractCode,
          buf,
          downloadObject,
          contractId,
        ),
        this.sendContractAlert(user, customerInfo, contractCode),
      ]);
      return downloadObject;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getContractByEventId
   * @param eventId
   * @returns
   */
  async getContractByEventId(eventId: string): Promise<unknown | undefined> {
    try {
      const contract = await this.contractRepository.findOne({
        where: { event: { id: eventId } },
      });
      let newContract = {};
      if (!contract) {
        return newContract;
      }
      const contractWithUserDetails = await this.userService.findByIdV2(
        contract.companyRepresentative,
      );
      if (!contractWithUserDetails) {
        throw new InternalServerErrorException(
          'Contact representative not found',
        );
      }
      const companyRepresentative = {
        id: contractWithUserDetails.id,
        fullName: contractWithUserDetails.fullName,
        email: contractWithUserDetails.email,
        phoneNumber: contractWithUserDetails.phoneNumber,
        dob: contractWithUserDetails.dob,
        avatar: contractWithUserDetails.avatar,
        status: contractWithUserDetails.status,
      };
      newContract = { ...contract, companyRepresentative };
      return newContract;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getAllContracts
   * @param filter
   * @param contractPagination
   * @param user
   * @returns
   */
  async getAllContracts(
    filter: FilterContract,
    contractPagination: ContractPagination,
    user: UserEntity,
  ): Promise<IPaginateResponse<unknown> | undefined> {
    try {
      const { currentPage, sizePage } = contractPagination;
      const { sortProperty, sort, status } = filter;
      const query = this.generalBuilderContracts();
      query.leftJoinAndSelect('contracts.event', 'event');
      query.leftJoinAndSelect('contracts.files', 'files');
      query.leftJoinAndSelect('contracts.customerContact', 'customerContact');
      query.select([
        'contracts.id as id',
        'contracts.customerName as customerName',
        'contracts.customerNationalId as customerNationalId',
        'contracts.customerEmail as customerEmail',
        'contracts.customerPhoneNumber as customerPhoneNumber',
        'contracts.customerAddress as customerAddress',
        'contracts.dateOfSigning as dateOfSigning',
        'contracts.companyRepresentative as companyRepresentative',
        'contracts.paymentMethod as paymentMethod',
        'contracts.createdAt as createdAt',
        'contracts.createdBy as createdBy',
        'contracts.updatedAt as updateAt',
        'contracts.updatedBy as updateBy',
        'contracts.status as contractStatus',
        'customerContact.id as customerContactId',
        'event.id as eventId',
        'event.eventName as eventName',
        'event.startDate as startDate',
        'event.endDate as endDate',
        'event.location as location',
        'event.processingDate as processingDate',
        'event.status as status',
        'event.eventType as eventType',
        'event.createdAt as eventCreatedAt',
        'event.createdBy as eventCreatedBy',
        'files.id as contractFileId',
        'files.contractCode as contractCode',
        'files.contractFileName as contractFileName',
        'files.contractFileSize as contractFile',
        'files.contractFileUrl as contractFileUrl',
        'files.rejectNote as rejectNote',
        'files.status as contractFileStatus',
      ]);
      if (user.role.toString() !== ERole.ADMIN) {
        query.where('contracts.companyRepresentative = :userId', {
          userId: user.id,
        });
      }
      if (status !== EContractStatus.ALL) {
        query.andWhere('contracts.status= :status', { status: status });
      }
      if (sortProperty) {
        query.orderBy(`contracts.${sortProperty}`, sort);
      }
      const [result, total] = await Promise.all([
        query
          .offset((sizePage as number) * ((currentPage as number) - 1))
          .limit(sizePage as number)
          .execute(),
        query.getCount(),
      ]);
      const listUser = await Promise.all(
        result.map((contract) => {
          if (contract.companyRepresentative) {
            return this.userService.findByIdV2(contract.companyRepresentative);
          }
          return contract;
        }),
      );
      const userMap = {};
      listUser.forEach((user) => {
        userMap[user?.id] = {
          id: user?.id,
          fullName: user?.fullName,
          email: user.email,
          phoneNumber: user?.phoneNumber,
          dob: user?.dob,
          avatar: user?.avatar,
          status: user?.status,
        };
      });
      const contractWithCompanyRepresentative = (result || []).map(
        (contract) => {
          if (contract?.companyRepresentative) {
            const userDetails = listUser?.[contract?.companyRepresentative];
            return {
              ...contract,
              userDetails,
            };
          }
          return contract;
        },
      );
      const formatData = this.formattedDataGetAllContract(
        contractWithCompanyRepresentative,
      );
      return paginateResponse<unknown>(
        [formatData, total],
        currentPage as number,
        sizePage as number,
      );
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * updateContractEvidence
   * @param contractId
   * @param type
   * @param files
   * @param user
   * @returns
   */
  async updateContractEvidence(
    contractId: string,
    type: EContractEvidenceType,
    files: FileRequest[],
    user: UserEntity,
  ): Promise<unknown | undefined> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const contract = await this.getContract(contractId);

      if (!contract) {
        throw new InternalServerErrorException('Contract not found');
      }

      const contractSuccess = this.getSuccessfulContracts(contract);

      if (contractSuccess.length <= 0) {
        throw new InternalServerErrorException(
          'Hiện chưa có hợp đồng nào được chấp thuận, vui lòng kiểm tra lại',
        );
      }
      let returnMessage = '';
      for (const [index, file] of files.entries()) {
        const number = index + 1;
        switch (type) {
          case EContractEvidenceType.CONTRACT_SIGNED:
            await this.processContractSigned(
              file,
              contract,
              contractSuccess,
              user,
              queryRunner,
              number,
            );
            returnMessage = 'Cập nhật hợp đồng đã ký thành công';
            break;
          case EContractEvidenceType.CONTRACT_PAID:
            await this.processContractPaid(
              file,
              contract,
              contractSuccess,
              user,
              queryRunner,
              number,
            );
            returnMessage = 'Cập nhật thanh toán hợp đồng thành công';
            break;
        }
      }
      await this.updateContractStatus(type, contractId, user, queryRunner);
      return returnMessage;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getContract
   * @param contractId
   * @returns
   */
  async getContract(contractId) {
    return await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['customerContact', 'files'],
    });
  }

  /**
   * getSuccessfulContracts
   * @param contract
   * @returns
   */
  getSuccessfulContracts(contract) {
    return contract?.files.filter(
      (file) => file.status === EContractStatus.ACCEPTED,
    );
  }

  /**
   * processContractSigned
   * @param file
   * @param contract
   * @param contractSuccess
   * @param user
   * @param queryRunner
   * @param number
   * @returns
   */
  async processContractSigned(
    file,
    contract,
    contractSuccess,
    user,
    queryRunner,
    number,
  ) {
    if (contract.status !== EContractStatus.WAIT_FOR_SIGN) {
      throw new BadRequestException(
        'Chưa có hợp đồng nào được chấp thuận để kí duyệt, vui lòng thử lại sau',
      );
    }
    const bufSign = await this.fileService.uploadFile(
      file,
      `contract/signed/${contractSuccess[0]?.contractCode}`, //file path to upload on Firebase
      `${contractSuccess[0]?.contractCode} - ${number} - SIGNED`,
    );
    if (!bufSign) return undefined;
    await queryRunner.manager.insert(ContractEvidenceEntity, {
      contract: contract,
      evidenceFileName: `${contractSuccess[0]?.contractCode} - ${number} - SIGNED`,
      evidenceFileSize: bufSign['fileSize'],
      evidenceFileType: bufSign['fileType'],
      evidenceType: EContractEvidenceType.CONTRACT_SIGNED,
      evidenceUrl: bufSign['downloadUrl'],
      createdBy: user.id,
    });
  }

  /**
   * processContractPaid
   * @param file
   * @param contract
   * @param contractSuccess
   * @param user
   * @param queryRunner
   * @param number
   * @returns
   */
  async processContractPaid(
    file,
    contract,
    contractSuccess,
    user,
    queryRunner,
    number,
  ) {
    if (contract.status !== EContractStatus.WAIT_FOR_PAID) {
      throw new BadRequestException(
        'Hợp đồng này chưa thể thanh toán, vui lòng kiểm tra lại trạng thái của hợp đồng',
      );
    }
    const buf = await this.fileService.uploadFile(
      file,
      `contract/transaction/${contractSuccess[0]?.contractCode}`, //file path to upload on Firebase
      `${contractSuccess[0]?.contractCode} - ${number} - PAID`,
    );
    if (!buf) return undefined;
    await queryRunner.manager.insert(ContractEvidenceEntity, {
      contract: contract,
      evidenceFileName: `${contractSuccess[0]?.contractCode} - ${number} - PAID`,
      evidenceFileSize: buf['fileSize'],
      evidenceFileType: buf['fileType'],
      evidenceUrl: buf['downloadUrl'],
      evidenceType: EContractEvidenceType.CONTRACT_PAID,
      createdBy: user.id,
    });
  }

  /**
   * updateContractStatus
   * @param type
   * @param contractId
   * @param user
   * @param queryRunner
   */
  async updateContractStatus(type, contractId, user, queryRunner) {
    let status;
    switch (type) {
      case EContractEvidenceType.CONTRACT_SIGNED:
        status = EContractStatus.WAIT_FOR_PAID;
        break;
      case EContractEvidenceType.CONTRACT_PAID:
        status = EContractStatus.PAID;
        break;
    }
    await queryRunner.manager.update(
      ContractEntity,
      { id: contractId },
      {
        updatedAt: moment.tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
        updatedBy: user.id,
        status: status,
      },
    );
  }

  /**
   * getEvidenceByContractId
   * @param contactId
   * @returns
   */
  async getEvidenceByContractId(
    contactId: string,
  ): Promise<ContractEvidenceEntity[]> {
    try {
      const evidence = await this.contractEvidenceEntity.find({
        where: { contract: { id: contactId } },
      });
      return evidence;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * updateStatusContractFile
   * @param contractFileId
   * @param rejectReason
   * @param status
   * @param user
   * @returns
   */
  async updateStatusContractFile(
    contractFileId: string,
    rejectReason: ContractRejectNote,
    status: EContractStatus,
    user: string,
  ): Promise<string> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const oUser = JSON.parse(user);
      const contractFileExisted = await queryRunner.manager.findOne(
        ContractFileEntity,
        {
          where: { id: contractFileId },
          relations: ['contract'],
        },
      );
      if (!contractFileExisted) {
        throw new NotFoundException('Không tìm thấy hợp đồng này');
      }

      const processedUser = await this.userService.findByIdV2(
        contractFileExisted?.contract?.companyRepresentative,
      );
      if (contractFileExisted.status === EContractStatus.PENDING) {
        switch (status) {
          case EContractStatus.ACCEPTED:
            const updateContractFileAccept = await queryRunner.manager.update(
              ContractFileEntity,
              {
                id: contractFileId,
              },
              {
                status: EContractStatus.ACCEPTED,
                updatedAt: moment
                  .tz('Asia/Bangkok')
                  .format('YYYY-MM-DD HH:mm:ss'),
              },
            );
            if (updateContractFileAccept.affected > 0) {
              await queryRunner.manager.update(
                ContractEntity,
                {
                  id: contractFileExisted?.contract?.id,
                },
                {
                  status: EContractStatus.WAIT_FOR_SIGN,
                  updatedAt: moment
                    .tz('Asia/Bangkok')
                    .format('YYYY-MM-DD HH:mm:ss'),
                },
              );
              // Send Notification
              const dataNotification: NotificationContractRequest = {
                title: `Hợp đồng được chấp thuận`,
                content: `Hợp đồng ${contractFileExisted?.contractCode} đã được khách hàng ${oUser?.fullName} chấp thuận`,
                type: ETypeNotification.CONTRACT,
                receiveUser: processedUser?.id,
                commonId: contractFileExisted?.contract?.id,
                contractId: contractFileExisted?.contract?.id,
                avatar: oUser?.avatar,
                messageSocket: 'notification',
              };
              await this.notificationService.createContractNotification(
                dataNotification,
                queryRunner,
              );
              return 'Hợp đồng được chấp thuận';
            } else {
              return 'Cập nhật hợp đồng thất bại, vui lòng thử lại';
            }
          case EContractStatus.REJECTED:
            if (rejectReason.rejectNote.length <= 0) {
              throw new BadRequestException(
                'Bạn cần phải nhập lý do từ chối hợp đồng này',
              );
            }
            await queryRunner.manager.update(
              ContractFileEntity,
              {
                id: contractFileId,
              },
              {
                status: EContractStatus.REJECTED,
                rejectNote: rejectReason.rejectNote,
                updatedAt: moment
                  .tz('Asia/Bangkok')
                  .format('YYYY-MM-DD HH:mm:ss'),
              },
            );
            // Send Notification
            const dataNotification: NotificationContractRequest = {
              title: `Hợp đồng bị từ chối`,
              content: `Hợp đồng ${contractFileExisted?.contractCode} đã bị khách hàng ${oUser?.fullName} từ chối`,
              type: ETypeNotification.CONTRACT,
              receiveUser: processedUser?.id,
              commonId: contractFileExisted?.contract?.id,
              contractId: contractFileExisted?.contract?.id,
              avatar: oUser?.avatar,
              messageSocket: 'notification',
            };
            await this.notificationService.createContractNotification(
              dataNotification,
              queryRunner,
            );
            return `Hợp đồng bị từ chối vì lí do: ${rejectReason.rejectNote}`;
        }
      }
      throw new InternalServerErrorException(
        `Hợp đồng này ${
          contractFileExisted.status === EContractStatus.ACCEPTED
            ? 'đã được chấp thuận, không thể cập nhật trạng thái ngay bây giờ'
            : 'đã bị từ chối, không thể cập nhật trạng thái ngay bây giờ'
        }`,
      );
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * recreateContract
   * @param customerContactId
   * @param user
   * @returns
   */
  async recreateContract(
    customerContactId: string,
    user: UserEntity,
  ): Promise<object | undefined> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const contactExisted = await queryRunner.manager.findOne(
        CustomerContactEntity,
        {
          where: { id: customerContactId, status: EContactInformation.ACCEPT },
          relations: ['contract', 'eventType'],
        },
      );
      const contractFiles: any = await this.getContractFileByCustomerContactId(
        customerContactId,
      );
      const hasPendingOrAcceptedFiles = contractFiles?.files.some((file) =>
        [EContractStatus.PENDING, EContractStatus.ACCEPTED].includes(
          file.status,
        ),
      );

      if (!contactExisted) {
        throw new NotFoundException(
          'Không thể tìm thấy thông tin người dùng này hoặc thông tin liên hệ này đã bị từ chối',
        );
      }
      if (contactExisted.contract === null) {
        throw new BadRequestException(
          'Hiện tại chưa có hợp đồng nào để tạo lại. Quán lý vui lòng tạo kế hoạch để có thể tạo hợp đồng',
        );
      }
      if (hasPendingOrAcceptedFiles) {
        throw new BadRequestException(
          'Đang có hợp đồng trong trạng thái chờ hoặc đã được đồng ý. Không thể tạo hợp đồng khác, vui lòng kiểm tra lại',
        );
      }
      const contractExisted = contactExisted?.contract;
      const dataObject: EventCreateRequestContract = {
        eventName: contractExisted.eventName,
        startDate: moment(contractExisted.startDate).format('YYYY-MM-DD'),
        processingDate: moment(contractExisted.processingDate).format(
          'YYYY-MM-DD',
        ),
        endDate: moment(contractExisted.endDate).format('YYYY-MM-DD'),
        location: contactExisted.address,
        eventTypeId: contactExisted.eventType.id,
        customerName: contractExisted.customerName,
        customerNationalId: contractExisted.customerNationalId,
        customerAddress: contractExisted.customerAddress,
        customerEmail: contractExisted.customerEmail,
        customerPhoneNumber: contractExisted.customerPhoneNumber,
        paymentMethod: contractExisted.paymentMethod,
        paymentDate: moment(contractExisted.paymentDate).format('YYYY-MM-DD'),
      };
      const newContract = await this.generateNewContract(
        dataObject,
        contactExisted.id,
        user,
      );
      return newContract;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getContractFileByCustomerContactId
   * @param customerContactId
   * @returns
   */
  async getContractFileByCustomerContactId(
    customerContactId: string,
  ): Promise<object | undefined> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const contactExisted = await queryRunner.manager.findOne(
        CustomerContactEntity,
        {
          where: { id: customerContactId },
          relations: ['contract', 'contract.files', 'eventType'],
        },
      );
      const contractTotalBudget = await this.planService.getTotalPriceOfPlan(
        customerContactId,
      );
      if (!contactExisted) {
        throw new NotFoundException('Hợp đồng này không tồn tại');
      }
      const sortedFiles = contactExisted?.contract?.files?.sort((a, b) => {
        const dateA = moment(a.createdAt).format('YYYY-MM-DD HH:mm:ss');
        const dateB = moment(b.createdAt).format('YYYY-MM-DD HH:mm:ss');
        return moment(dateB, 'YYYY-MM-DD HH:mm:ss').diff(
          moment(dateA, 'YYYY-MM-DD HH:mm:ss'),
        );
      });
      const contractResponse = {
        eventTypeId: contactExisted?.eventType?.id,
        contractTotalBudget: contractTotalBudget,
        description: contactExisted?.note,
        ...contactExisted?.contract,
        files: sortedFiles,
      };
      return contractResponse;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getAllContractFile
   * @returns
   */
  async getAllContractFile(): Promise<ContractEntity[]> {
    try {
      const contractExisted = await this.contractRepository.find({
        relations: {
          files: true,
          customerContact: true,
        },
      });
      if (!contractExisted) {
        throw new NotFoundException('Hợp đồng này không tồn tại');
      }
      const dataFinal = contractExisted?.map((item) => {
        item.files?.sort((a, b) => {
          const dateA = moment(a?.createdAt).format('YYYY-MM-DD HH:mm:ss');
          const dateB = moment(b?.createdAt).format('YYYY-MM-DD HH:mm:ss');
          return moment(dateB, 'YYYY-MM-DD HH:mm:ss').diff(
            moment(dateA, 'YYYY-MM-DD HH:mm:ss'),
          );
        });
        const customerContactId = item?.customerContact?.id;
        delete item.customerContact;
        return { customerContactId, ...item };
      });
      return dataFinal;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * getAllContractFileByCustomer
   * @param user
   * @returns
   */
  async getAllContractFileByCustomer(user: string): Promise<ContractEntity[]> {
    try {
      const oUser = JSON.parse(user);
      const queryRunner = this.dataSource.createQueryRunner();
      const contractExisted = await queryRunner.manager.find(ContractEntity, {
        where: {
          customerEmail: oUser?.email,
        },
        relations: {
          files: true,
        },
      });
      if (!contractExisted) {
        throw new NotFoundException('Hợp đồng này không tồn tại');
      }
      const dataFinal = contractExisted?.map((item) => {
        item.files?.sort((a, b) => {
          const dateA = moment(a.createdAt).format('YYYY-MM-DD HH:mm:ss');
          const dateB = moment(b.createdAt).format('YYYY-MM-DD HH:mm:ss');
          return moment(dateB, 'YYYY-MM-DD HH:mm:ss').diff(
            moment(dateA, 'YYYY-MM-DD HH:mm:ss'),
          );
        });
        return item;
      });
      return dataFinal;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateContractInfo(
    contractId: string,
    data: UpdateContractInfo,
    user: UserEntity,
  ): Promise<string> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const contractExisted = await queryRunner.manager.findOne(
        ContractEntity,
        {
          where: { id: contractId },
          relations: ['files'],
        },
      );
      if (!contractExisted) {
        throw new InternalServerErrorException('Hợp đồng này không tồn tại');
      }
      const hasPendingOrAcceptedFiles = contractExisted?.files.some(
        (file) =>
          file.status === EContractStatus.PENDING ||
          file.status === EContractStatus.ACCEPTED,
      );
      if (hasPendingOrAcceptedFiles) {
        throw new BadRequestException(
          'Đang có hợp đồng trong trạng thái chờ hoặc đã được đồng ý. Bạn không thể nào cập nhậ thông tin hợp đồng, vui lòng kiểm tra lại sau',
        );
      }
      if (contractExisted.status !== EContractStatus.PENDING) {
        let errorMessage;
        if (contractExisted.status === EContractStatus.WAIT_FOR_SIGN) {
          errorMessage = 'kí kết';
        } else if (contractExisted.status === EContractStatus.PAID) {
          throw new BadRequestException(
            `Hợp đồng này đã được thanh toán, không thể cập nhật thông tin hợp đồng`,
          );
        } else {
          errorMessage = 'thanh toán';
        }
        throw new BadRequestException(
          `Hợp đồng này đang được tiến hành ${errorMessage}. Không thể thực hiện cập nhật thông tin hợp đồng`,
        );
      }
      const updatedContractInfo = await queryRunner.manager.update(
        ContractEntity,
        {
          id: contractId,
        },
        {
          customerName: data.customerName,
          customerNationalId: data.customerNationalId,
          customerEmail: data.customerEmail,
          customerPhoneNumber: data.customerPhoneNumber,
          customerAddress: data.customerAddress,
          paymentMethod: data.paymentMethod,
          eventName: data.eventName,
          startDate: data.startDate,
          processingDate: data.startDate,
          endDate: data.endDate,
          location: data.location,
          paymentDate: data.paymentDate,
          updatedBy: user.id,
          updatedAt: moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
        },
      );
      if (updatedContractInfo.affected > 0) {
        return 'Cập nhật thành công thông tin hợp đồng';
      }
      throw new InternalServerErrorException(
        'Cập nhật thông tin hợp đồng thất bại',
      );
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  private async convertDocxToPdf(buf: Buffer): Promise<Buffer> {
    try {
      const result = await new Promise<Buffer>((resolve, reject) => {
        libre.convert(buf, 'pdf', undefined, (err, done) => {
          if (err) {
            reject(err);
          }
          resolve(done);
        });
      });
      return result;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  private generalBuilderContracts(): SelectQueryBuilder<ContractEntity> {
    return this.contractRepository.createQueryBuilder('contracts');
  }

  private async downloadTemplate(path: string): Promise<Buffer | undefined> {
    try {
      const bucket = admin.storage().bucket(); // Get the default bucket
      const file = bucket.file(path);
      // Download the file
      const data = await file.download();
      const buffer = data[0] as Buffer;
      return buffer;
    } catch (err) {
      return undefined;
    }
  }

  private async uploadFile(
    buf: Buffer,
    fileName: string,
  ): Promise<object | undefined> {
    try {
      const pdfBuf = await this.convertDocxToPdf(buf);
      //upload to firebase storage
      const bucket = admin.storage().bucket();
      const filePath = `contract/${fileName}`;
      const file = bucket.file(filePath);
      await file.save(pdfBuf, {
        metadata: {
          contentType: 'application/pdf',
        },
      });
      const downloadUrl = await file.getSignedUrl({
        action: 'read',
        expires: '2030-01-01',
      });
      const downloadInfo = {
        downloadUrl: downloadUrl[0],
        fileSize: pdfBuf.length,
      };
      return downloadInfo;
    } catch (err) {
      console.error('Error uploading file:', err);
      return undefined;
    }
  }

  private async generateContractDocs(
    contractRequest: EventCreateRequestContract,
    contactId: string,
    userId: UserEntity,
  ): Promise<Buffer | undefined> {
    try {
      const user = await this.userService.findOne({
        where: { id: userId.id },
        relations: ['profile', 'role'],
      });
      if (!user) {
        throw new InternalServerErrorException(
          'User not found or deleted by admin',
        );
      }
      //download contract template
      const template = await this.downloadTemplate(
        'contract/template/Contract_Template.docx',
      );
      let doc = undefined;
      if (template) {
        const zip = new PizZip(template);
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
      }
      const calculateDuration = this.sharedService.calculateDuration(
        contractRequest?.startDate,
        contractRequest?.endDate,
      );
      const formattedDateProcessing = this.sharedService.formatDateToString(
        contractRequest?.processingDate,
        'DD/MM/YYYY HH:mm:ss',
      );
      const dataPlan: any = await this.planService.getPlanByCustomerContactId(
        contactId,
      );
      const plan = dataPlan?.plan;
      if (plan?.length <= 0) {
        throw new BadRequestException(
          'Quản lý vui lòng tạo kế hoạch trước khi tạo hợp đồng',
        );
      }
      let index = 1;
      let plannedTotalPrice = 0;
      plan.map((category) => {
        (category?.items || []).map((item) => {
          const itemTotalPrice = item?.plannedPrice * item?.plannedAmount;
          plannedTotalPrice += itemTotalPrice;
          item.plannedPrice = this.sharedService.formattedCurrency(
            parseFloat(item?.plannedPrice),
          );
          item.itemTotalPrice = this.sharedService.formattedCurrency(
            parseFloat(String(itemTotalPrice)),
          );
          item.index = index++;
        });
      });
      const plannedBackup = plannedTotalPrice * 0.05;
      const plannedVAT = (plannedTotalPrice + plannedBackup) * 0.1;
      const plannedTotal = plannedTotalPrice + plannedBackup + plannedVAT;
      const plannedTotalPriceFormatted =
        this.sharedService.formattedCurrency(plannedTotalPrice);
      const plannedBackupFormatted =
        this.sharedService.formattedCurrency(plannedBackup);
      const plannedVATFormatted =
        this.sharedService.formattedCurrency(plannedVAT);
      const plannedTotalFormatted =
        this.sharedService.formattedCurrency(plannedTotal);
      const contractValueByName = this.sharedService.moneyToWord(
        parseFloat(String(plannedTotal)),
      );
      if (doc) {
        doc?.render({
          companyRepresentativeName: user?.profile?.fullName,
          companyRepresentativeRole: user?.role?.roleName,
          companyRepresentativeNationalId: user?.profile?.nationalId,
          compannyRepresentativePhoneNumber: user?.profile?.phoneNumber,
          companyRepresentativeEmail: user?.email,
          customerName: contractRequest?.customerName,
          customerNationalId: contractRequest?.customerNationalId,
          customerAddress: contractRequest?.customerAddress,
          customerPhoneNumber: contractRequest?.customerPhoneNumber,
          customerEmail: contractRequest?.customerEmail,
          eventName: contractRequest?.eventName,
          eventAddress: contractRequest?.location,
          processingDate: formattedDateProcessing,
          duration: calculateDuration,
          contractValue: plannedTotalFormatted,
          contractValueByName: contractValueByName,
          paymentMethod: contractRequest?.paymentMethod,
          plan: plan,
          plannedTotalPrice: plannedTotalPriceFormatted,
          plannedBackup: plannedBackupFormatted,
          plannedVAT: plannedVATFormatted,
          plannedTotal: plannedTotalFormatted,
        });
        const buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
        return buf;
      }
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * formattedDataGetAllContract
   * @param rawData
   * @returns
   */
  private formattedDataGetAllContract(rawData: any): any {
    const groupedData = {};
    rawData.forEach((item) => {
      if (!groupedData[item.id]) {
        groupedData[item.id] = {
          contractId: item?.id,
          customerName: item?.customerName,
          customerNationalId: item?.customerNationalId,
          customerEmail: item?.customerEmail,
          customerPhoneNumber: item.customerPhoneNumber,
          customerAddress: item.customerAddress,
          dateOfSigning: item.dateOfSigning,
          customerContactId: item.customerContactId,
          paymentMethod: item.paymentMethod,
          createdAt: item.createdAt,
          createdBy: item.createdBy,
          updateAt: item.updateAt,
          updateBy: item.updateBy,
          contractStatus: item.contractStatus,
          companyRepresentative: item.companyRepresentative,
          event: {},
          files: [],
        };
      }
      if (
        item.eventId === null &&
        item.eventName === null &&
        item.startDate === null &&
        item.endDate === null &&
        item.location === null &&
        item.processingDate === null &&
        item.status === null &&
        item.eventType === null &&
        item.eventCreatedAt === null &&
        item.eventCreatedBy === null
      ) {
        groupedData[item.id].event = null;
      } else {
        groupedData[item.id].event = {
          eventId: item.eventId,
          eventName: item.eventName,
          startDate: item.startDate,
          endDate: item.endDate,
          location: item.location,
          processingDate: item.processingDate,
          status: item.status,
          eventType: item.eventType,
          eventCreatedAt: item.eventCreatedAt,
          eventCreatedBy: item.eventCreatedBy,
        };
      }
      if (
        !Object.values(item).every((value) => value === null) &&
        item.contractCode
      ) {
        groupedData[item.id].files.push({
          contractFileId: item.contractFileId,
          contractCode: item.contractCode,
          contractFileName: item.contractFileName,
          contractFile: item.contractFile,
          contractFileUrl: item.contractFileUrl,
          rejectNote: item.rejectNote,
          contractFileStatus: item.contractFileStatus,
        });
      }
    });
    return Object.values(groupedData);
  }
}
