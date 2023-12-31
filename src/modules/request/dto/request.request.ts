import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum } from 'class-validator';
import moment from 'moment';
import {
  EReplyRequest,
  ERequestStatus,
  ERequestType,
} from 'src/common/enum/enum';
import { UserCreateRequest } from 'src/modules/user/dto/user.request';

export class RequestCreateRequest {
  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ default: new Date() })
  startDate: Date;

  @ApiProperty({ default: new Date() })
  endDate: Date;

  @ApiProperty({ default: true })
  isFull: boolean;

  @ApiProperty({ default: false })
  isPM: boolean;

  @ApiProperty({ enum: ERequestType, default: ERequestType.A })
  @IsEnum(ERequestType)
  type: ERequestType;
}

export class UpdateRequestStatusReq {
  @ApiProperty()
  requestID: string;

  @ApiProperty({ required: false })
  replyMessage: string;

  @ApiProperty({
    type: 'enum',
    enum: EReplyRequest,
    default: EReplyRequest.ACCEPT,
  })
  status: EReplyRequest;
}

export class FilterRequest {
  @ApiProperty({ required: false })
  requestor: string;

  @ApiProperty({ required: false })
  requestorName: string;

  @ApiProperty({ default: new Date(), required: false })
  createdAt: Date;

  @ApiProperty({ enum: ERequestStatus, required: false })
  status: ERequestStatus;

  @ApiProperty({ enum: ERequestType, required: false })
  type: ERequestType;
}

export class requestEmployee {
  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  form: UserCreateRequest;
}
