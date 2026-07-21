import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { AuthService } from '../../auth/providers/auth.service';
import { DatabaseService } from '../../database/providers/database.service';
import { CreateUserDto } from '../dto/create-user-param.dto';
import { HashingService } from '../../common/hashing/providers/hashing.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly dbService: DatabaseService,
    private readonly hashingService: HashingService,
  ) {}

  private async mapDtoToPrismaInput(
    dto: CreateUserDto,
  ): Promise<Prisma.UserUncheckedCreateInput> {
    return {
      first_name: dto.firstName,
      last_name: dto.lastName,
      email: dto.email,
      photo_url: dto.photoUrl,
      address_id: dto.addressId,
      role: dto.role,
      password_hash: await this.hashingService.hash(dto.password),
    };
  }

  public async createUser(dto: CreateUserDto) {
    const data = await this.mapDtoToPrismaInput(dto);
    return await this.dbService.user.create({ data });
  }

  //TODO: Add pagination
  public getUsers() {
    // const isAuthenticated = this.authService.isAuthenticated('jwt-token');
    // if (!isAuthenticated) {
    //     throw new Error('Unauthorized');
    // }
    return this.dbService.user.findMany();
  }
  public getUserById(id: string) {
    return this.dbService.user.findUnique({ where: { id } });
  }
}
