import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/extension';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit{
    //1. since we are extending PrismaClient, we're going to be able to inject 
    // it anywhere in the code and make use of the types Prisma Client generated based off of the schemas.
    //2.Since implementing onModuleInit, you gotta connect to the database on startup

    async onModuleInit(){
        await this.$connect();
    }
}
