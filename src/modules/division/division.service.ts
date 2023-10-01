
import DivisionRepository from './division.repository';
import { ResponseData, TransformInterceptor } from './../../middleware/transform.interceptor';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DivisionEntity } from './division.entity';
import { BaseService } from '../base/base.service';
import { DivisionCreateRequest, DivisionUpdateRequest } from './dto/division.request';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { plainToClass, plainToInstance } from 'class-transformer';
import { DivisionResponse } from './dto/division.response';
import { EUserStatus } from 'src/common/enum/enum';
import { DivisionPagination } from './dto/division.pagination';
import { paginateResponse } from '../base/filter.pagination';

@Injectable()
export class DivisionService extends BaseService<DivisionEntity> {

    constructor(
        @InjectRepository(DivisionEntity)
        private readonly divisionRepository: DivisionRepository,
        @InjectDataSource()
        private dataSource: DataSource,
    ) {
        super(divisionRepository)
    }

    generalBuilderDivision(): SelectQueryBuilder<DivisionEntity> {
        return this.divisionRepository.createQueryBuilder('division');
    }

    async createDivision(division: DivisionCreateRequest): Promise<string> {
        const queryRunner = this.dataSource.createQueryRunner();
        try {
            const divisionExist = await queryRunner.manager.findOne(DivisionEntity, {
                where: { divisionName: division.divisionName }
            });
            if (divisionExist) {
                throw new InternalServerErrorException('Division already exists');
            }
            await queryRunner.manager.insert(DivisionEntity, {
                divisionName: division.divisionName,
                status: true,
            })
            await queryRunner.commitTransaction();
            return `Division created successfully`
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw new InternalServerErrorException(err);
        }
    }

    async getDivisionById(id: string) {
        try {
            const division = await this.findOne({
                where: { id: id }
            });

            if (!division) {
                throw new NotFoundException('Division not found');
            }
            return plainToClass(DivisionResponse, division);
        } catch (err) {
            throw new InternalServerErrorException(err.message);
        }
    }

    async updateDivision(id: string, data: DivisionUpdateRequest): Promise<string> {
        try {
            const divisionExist = await this.getDivisionById(id);
            if (!divisionExist) {
                throw new NotFoundException('Division not found');
            }
            if (data.status !== divisionExist.status) {
                const query = this.generalBuilderDivision();
                query.leftJoin('account', 'account', 'account.divisionId = division.id')
                query.where('division.id = :id', { id: id });
                query.andWhere('account.status = :status', { status: EUserStatus.ACTIVE });
                const account = await query.getCount();
                if (account > 0) {
                    throw new BadRequestException('Division is being used. Please modify the account first')
                }
            }
            const result = await this.divisionRepository.update(id, data);
            if (result.affected === 0) {
                throw new InternalServerErrorException('Update failed');
            }
            return 'Update successfully';

        } catch (err) {
            throw new InternalServerErrorException(err.message);
        }
    }

    async getAllDivision(divisionPagination: DivisionPagination): Promise<any> {
        try {
            const { currentPage, sizePage } = divisionPagination;
            const query = this.generalBuilderDivision();
            const [result, total] = await Promise.all([
                query.skip((sizePage as number) * ((currentPage as number) - 1))
                    .take(sizePage as number).execute(),
                query.getCount()
            ])
            if (total === 0) {
                throw new NotFoundException('Division not found');
            }
            const data = plainToInstance(DivisionResponse, result);
            return paginateResponse<DivisionResponse>(
                [data, total],
                currentPage as number,
                sizePage as number
            )
        } catch (err) {
            throw new InternalServerErrorException(err.message);
        }
    }

    async updateStatus(divisionId: string): Promise<string> {
        try {
            const division = await this.getDivisionById(divisionId);
            if (!division) {
                throw new NotFoundException('Division not found');
            }
            if (division.status === true) {
                const query = this.generalBuilderDivision();
                query.leftJoin('user', 'user', 'user.divisionId = division.id')
                query.where('division.id = :id', { id: divisionId });
                query.andWhere('user.status = :status', { status: EUserStatus.ACTIVE });
                const account = await query.getCount();
                if (account > 0) {
                    throw new BadRequestException('Division is being used. Please modify the account first')
                }
            }
            const result = await this.divisionRepository.update(divisionId, { status: !division.status });
            if (result.affected === 0) {
                throw new InternalServerErrorException('Update failed');
            }
            if (division.status === true) {
                return 'Disable division succesfully';
            }
            return 'Enable division succesfully';

        } catch (err) {
            throw new InternalServerErrorException(err.message);
        }
    }



}