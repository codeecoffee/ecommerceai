import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user-param.dto';

export class PatchUserDTO extends PartialType(CreateUserDto) {}