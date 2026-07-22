import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './providers/posts.service';
import { UsersModule } from '../users/users.module';
import { PostsMapper } from './providers/posts.mapper';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostsMapper],
  imports:[UsersModule],
})
export class PostsModule {}
