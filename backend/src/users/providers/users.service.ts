import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  User,
} from '../../../prisma/src/generated/prisma/client';
import { AuthService } from '../../auth/providers/auth.service';
import { DatabaseService } from '../../database/providers/database.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { HashingService } from '../../common/hashing/providers/hashing.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UsersMapper } from '../mappers/users.mapper';
import { UserResponseDto } from '../dto/response-user.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';
import { AddressService } from '../../address/providers/address.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly dbService: DatabaseService,
    private readonly hashingService: HashingService,
    private readonly addressService: AddressService,
  ) {}

  public async createUser(dto: CreateUserDto): Promise<{
    user: UserResponseDto;
    access_token: string;
    refresh_token: string;
  }> {
    const data: Prisma.UserUncheckedCreateInput = {
      ...UsersMapper.toCreateInput(dto),
      password_hash: await this.hashingService.hash(dto.password),
    };

    let user: User;
    try {
      user = await this.dbService.user.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
    const tokens = await this.authService.issueToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: UsersMapper.toResponseDto(user),
      ...tokens,
    };
    // return UsersMapper.toResponseDto(user);
  }
  //decides whether or not return the pagination
  public async getUsers(query: GetUsersQueryDto) {
    const hasPagination = query.page != undefined || query.limit !== undefined;

    return hasPagination ? this.getUsersPaginated(query) : this.getAllUsers();
  }

  private async getUsersPaginated(
    query: GetUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
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
      data: users.map((user) => UsersMapper.toResponseDto(user)),
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getAllUsers(): Promise<PaginatedResponseDto<UserResponseDto>> {
    const users = await this.dbService.user.findMany({
      orderBy: { first_name: 'desc' },
    });
    return {
      data: users.map((user) => UsersMapper.toResponseDto(user)),
      metadata: null,
    };
  }

  public async getUserById(id: string): Promise<UserResponseDto> {
    const user = await this.dbService.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    return UsersMapper.toResponseDto(user);
  }

  // public async findUserById(id: string): Promise<User | null>{
  //   return await this.dbService.user.findUnique({ where: { id } })
  // }

  public async getUserByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.dbService.user.findUnique({ where: { email } });

    return user ? UsersMapper.toResponseDto(user) : null;
  }

  public findUserWithPassHash(email: string): Promise<User | null> {
    return this.dbService.user.findUnique({ where: { email } });
  }

  public async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      const data: Prisma.UserUncheckedUpdateInput =
        UsersMapper.toUpdateInput(dto);

      const user = await this.dbService.user.update({
        where: { id },
        data,
      });

      return UsersMapper.toResponseDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User id ${id} not found`);
      }
      throw error;
    }
  }

  public async updateUserRole(
    id: string,
    role: Role,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.dbService.user.update({
        where: { id },
        data: { role },
      });

      return UsersMapper.toResponseDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with id ${id} not found`);
      }
      throw error;
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      await this.dbService.user.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User id ${id} not found`);
      }
      throw error;
    }
  }

  public async removeUserAddress(userId: string) {
    return this.addressService.removeUserFromAddressAndCleanUp(userId);
  }
}
