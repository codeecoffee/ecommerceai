import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../../prisma/src/generated/prisma/client';
import { AuthService } from '../../auth/providers/auth.service';
import { DatabaseService } from '../../database/providers/database.service';
import { CreateUserDto } from '../dto/create-user-param.dto';
import { HashingService } from '../../common/hashing/providers/hashing.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UsersMapper } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly dbService: DatabaseService,
    private readonly hashingService: HashingService,
    private readonly userMapper: UsersMapper
  ) {}

  public async createUser(dto: CreateUserDto) {
    const data: Prisma.UserUncheckedCreateInput = {
      ...this.userMapper.mapCommonFields(dto),
      password_hash: await this.hashingService.hash(dto.password),
    };
    return this.dbService.user.create({ data });
  }

  //!TODO: include auth
  public async getUsers(query: GetUsersQueryDto) {
    // const isAuthenticated = this.authService.isAuthenticated('jwt-token');
    // if (!isAuthenticated) {
    //     throw new Error('Unauthorized');
    // }
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.dbService.user.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.dbService.user.count(),
    ]);
    return {
      data: users,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getUserById(id: string) {
    return await this.dbService.user.findUnique({ where: { id } });
  }

  public async getUserByEmail(email:string){
    return await this.dbService.user.findFirst({where:{ email }})
  }

  public async updateUser(id: string, dto: UpdateUserDto) {
    const data: Prisma.UserUncheckedUpdateInput = this.userMapper.mapCommonFields(dto);
    return await this.dbService.user.update({
      where: { id },
      data,
    });
  }

  public async updateUserRole(id: string, role: Role) {
    return this.dbService.user.update({
      where: { id },
      data: { role },
    });
  }

  public async deleteUser(id: string) {
    return await this.dbService.user.delete({ where: { id } });
  }
}
