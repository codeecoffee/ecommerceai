import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../prisma/src/generated/prisma/client';


@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit{
    //1. since we are extending PrismaClient, we're going to be able to inject 
    // it anywhere in the code and make use of the types Prisma Client generated based off of the schemas.
    //2.Since implementing onModuleInit, you gotta connect to the database on startup
    //TODO: delete console.log for prod
    async onModuleInit(){
        await this.$connect()
        .then(()=>console.log('DB Connection Successful'))
        .catch((err)=>{console.log(err)})
    }
}
