import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { LoginDto } from 'src/auth/dto/login.dto';
import { ERole } from 'src/common/enum/enum';
import { GetUser } from 'src/decorators/getUser.decorator';
import { Public } from 'src/decorators/public.decorator';
import { Roles } from 'src/decorators/role.decorator';
import { UserCreateRequest } from 'src/modules/user/dto/user.request';
import { PayloadUser } from 'src/modules/user/dto/user.response';

@ApiBearerAuth()
@Controller('auth')
@ApiTags('auth-controller')
export class AuthenticationController {
  constructor(private readonly authService: AuthService) {}

  /**
   * http://localhost:6969/api/v1/login(Post)
   * login
   * @param user
   * @returns
   */
  @Post('/login')
  @Public()
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login successfully' })
  async login(@Body() data: LoginDto): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    return this.authService.login(data.email, data.password);
  }
  /**
   *  http://localhost:6969/api/v1/sign-up(Post)
   * @param userRequest
   * @returns
   */
  @Public()
  @Post('sign-up')
  async signUp(@Body() userRequest: UserCreateRequest): Promise<string> {
    return await this.authService.signUp(userRequest);
  }

  @Roles(ERole.EMPLOYEE)
  @Get('me')
  getMe(@GetUser() user: string): PayloadUser {
    return JSON.parse(user);
  }
}
