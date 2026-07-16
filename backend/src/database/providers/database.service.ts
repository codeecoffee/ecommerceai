import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../prisma/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';


@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit{
    //1. since we are extending PrismaClient, we're going to be able to inject 
    // it anywhere in the code and make use of the types Prisma Client generated based off of the schemas.
    //2.Since implementing onModuleInit, you gotta connect to the database on startup
    //TODO: delete console.log for prod

    /*
        specific to Prisma 7 + driver adapters. Since you have @prisma/adapter-pg in 
        your dependencies, your generated client is almost certainly configured 
        to require a driver adapter — and Prisma 7 no longer allows new PrismaClient() 
        with zero/empty config in that case. You must explicitly pass the adapter instance.
    */
    constructor(){
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        })
        super({adapter})
    }


    async onModuleInit(){
        await this.$connect()
        .then(()=>console.log('DB Connection Successful'))
        .catch((err)=>{console.log(err)})
    }
}
