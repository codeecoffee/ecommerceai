import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseService } from "../../database/providers/database.service";
import { User } from "../../../prisma/src/generated/prisma/client";
import { OWNERSHIP_KEY, OwnershipConfig } from "../decorators/check-ownership.decorator";

@Injectable()
export class OwnershipOrAdminGuard implements CanActivate{
    
    constructor(
        private readonly reflector: Reflector,
        private readonly dbService: DatabaseService
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: any = context.switchToHttp().getRequest()
        const user: User = request.user

        if(user.role === 'ADMIN') return true

        const config = this.reflector.get<OwnershipConfig>(
            OWNERSHIP_KEY,
            context.getHandler()
        )


        // No @CheckOwnership set → fall back to simple 
        // "id in URL === my own id" (e.g. GET /users/:id)
        if(!config) return request.params.id === user.id

        const resourceId = request.params[config.paramName ?? 'id']
        return this.resolveOwnership(config.resource, resourceId, user.id)
    }

    private async resolveOwnership(
        resource: OwnershipConfig['resource'],
        resourceId: string,
        userId: string
    ):Promise<boolean>{
        
        switch(resource){
            case 'address': {
                const address = await this.dbService.address.findUnique({
                    where: { address_id: resourceId },
                    select: { users: { select: {id: true} } }
                })
                return !!address?.users.some((u)=> u.id === userId)
            }
            case 'order': {
                const order = await this.dbService.order.findUnique({
                    where: { order_id: resourceId },
                    select: { user_id: true }
                })
                return order?.user_id === userId
            }
            case 'product': {
                return false // products aren't user-owned — this case probably never applies
            }

            default:
                return false

        }
    }







    // canActivate(context: ExecutionContext): boolean {
    //     const request = context.switchToHttp().getRequest()
    //     const currentUser = request.user
    //     const targetUserId = request.params.id

    //     if(!currentUser) throw new ForbiddenException('Not authenticated')
        
    //     const isAdmin = currentUser.role == 'ADMIN'
    //     const isOwner = currentUser.id == targetUserId

    //     if(isAdmin || isOwner) return true

    //     throw new ForbiddenException('You dont have permission to access this resource')
    // }

}