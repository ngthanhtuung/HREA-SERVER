import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export default class ForgetPasswordRequest {
  @IsNotEmpty()
  @ApiProperty({ default: 'huydoanmec@gmail.com' })
  email: string;
  @IsNotEmpty()
  @ApiProperty({ default: '123456' })
  password: string;
}
