import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class OwnershipOrAdminGuard implements CanActivate{
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const currentUser = request.user
        const targetUserId = request.params.id

        if(!currentUser) throw new ForbiddenException('Not authenticated')
        
        const isAdmin = currentUser.role == 'ADMIN'
        const isOwner = currentUser.id == targetUserId

        if(isAdmin || isOwner) return true

        throw new ForbiddenException('You dont have permission to access this resource')
    }

}