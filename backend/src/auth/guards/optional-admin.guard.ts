import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAdminGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // No token at all -> treat this as public signup, let it through
    if (!authHeader) return null; //request.user stays undefined, but req come in

    //A token was sent but failed the validation
    if (err || !user)
      throw new UnauthorizedException(info?.message || 'Invalid token');

    //Token is valid - inforce the role rule
    if (user.role != 'ADMIN') {
      throw new ForbiddenException(
        'Only admins can create accounts on behalf of other users',
      );
    }
    return user;
  }
}
