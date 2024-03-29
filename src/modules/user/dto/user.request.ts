import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import * as moment from 'moment';
import { EGender, ETypeEmployee, EUserStatus } from 'src/common/enum/enum';
import { FilterPaginationBase } from 'src/modules/base/filter.pagination';

export class UserCreateRequest {
  @ApiProperty({ default: 'bao@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ default: '12345678' })
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ default: 'test' })
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ default: new Date() })
  @Transform(({ value }) => {
    return moment(value).format('YYYY-MM-DD');
  })
  dob?: Date;

  @ApiProperty({ default: '121212' })
  nationalId?: string;

  @ApiProperty({ default: EGender.MALE, enum: EGender })
  @IsEnum(EGender)
  gender?: EGender;

  @ApiProperty({ default: 'abc test' })
  address?: string;

  @ApiProperty({ default: 'test' })
  avatar?: string;

  @IsNotEmpty()
  @ApiProperty({})
  divisionId?: string;

  @IsString()
  @ApiProperty()
  roleId?: string;

  @ApiProperty({ default: ETypeEmployee.FULL_TIME, enum: ETypeEmployee })
  @IsEnum(ETypeEmployee)
  typeEmployee?: ETypeEmployee;
}

export class CustomerCreateRequest {
  @ApiProperty({ default: 'bao@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ default: '12345678' })
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ default: '12345678' })
  password?: string;

  @ApiProperty({ default: 'test' })
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ default: EGender.MALE, enum: EGender })
  @IsEnum(EGender)
  gender?: EGender;

  @ApiProperty({ default: 'abc test' })
  address?: string;

  @ApiProperty({ default: 'test' })
  avatar?: string;
}

export class UserPagination extends FilterPaginationBase {}

export class UserProfileUpdateRequest extends OmitType(UserCreateRequest, [
  'email',
  'divisionId',
  'roleId',
  'typeEmployee',
]) {
  @ApiProperty({ default: 'test' })
  nationalIdImage?: string;
}

export class UserProfileUpdateRequestV2 extends UserCreateRequest {
  @IsNotEmpty()
  @ApiProperty({
    default: EUserStatus.ACTIVE,
  })
  status: EUserStatus;
}

export class FilterFreeEmployee {
  @ApiProperty({ default: new Date() })
  startDate: Date;

  @ApiProperty({ default: new Date() })
  endDate: Date;
}
