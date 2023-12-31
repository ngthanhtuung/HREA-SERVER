import { OmitType } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { EGender, EUserStatus } from 'src/common/enum/enum';

export class UserResponse {
  @Expose()
  id: string;

  @Expose()
  role: string;

  @Expose()
  password: string;

  @Expose()
  status: EUserStatus;

  @Expose()
  divisionId: string;

  @Expose()
  avatar: string;

  @Expose()
  fullName: string;

  @Expose()
  typeEmployee: string;
}

export class PayloadUser extends OmitType(UserResponse, ['password']) {
  @Expose()
  fullName: string;
  @Expose()
  email: string;
  @Expose()
  socketId: string;
}

export class UserProfile extends OmitType(UserResponse, ['password']) {
  @Expose()
  fullName: string;

  @Expose()
  email: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  dob: string;

  @Expose()
  nationalId: string;

  @Expose()
  gender: EGender;

  @Expose()
  address: string;

  @Expose()
  avatar: string;
}

export class VerifyCode {
  @Expose()
  authCode: string;

  @Expose()
  issueDate: string;
}
