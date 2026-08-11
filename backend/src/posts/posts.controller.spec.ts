import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './providers/posts.service';

describe('PostsController', () => {
  let controller: PostsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createPost: jest.fn(),
      getAllPostsForProd: jest.fn(),
      getPostById: jest.fn(),
      getPostsByAuthor: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();

    controller = module.get(PostsController);
  });

  it('createPost passes productId, the dto, and the current user id through to the service', async () => {
    const dto = { content: 'nice product' } as any;
    service.createPost.mockResolvedValue({ id: 'post-1' });

    await controller.createPost('prod-1', dto, { id: 'user-1' });

    expect(service.createPost).toHaveBeenCalledWith('prod-1', dto, 'user-1');
  });

  it('getProductPosts forwards productId and the query dto', async () => {
    const query = { page: 1, limit: 10 } as any;

    await controller.getProductPosts('prod-1', query);

    expect(service.getAllPostsForProd).toHaveBeenCalledWith('prod-1', query);
  });

  it('getPostsById forwards postId', async () => {
    await controller.getPostsById('post-1');
    expect(service.getPostById).toHaveBeenCalledWith('post-1');
  });

  it('getPostsByAuthor forwards authorId and the query dto', async () => {
    const query = {} as any;

    await controller.getPostsByAuthor('author-1', query);

    expect(service.getPostsByAuthor).toHaveBeenCalledWith('author-1', query);
  });

  it('updatePost forwards postId and the update dto', async () => {
    const dto = { content: 'edited' } as any;

    await controller.updatePost('post-1', dto);

    expect(service.updatePost).toHaveBeenCalledWith('post-1', dto);
  });

  it('deletePost forwards postId', async () => {
    await controller.deletePost('post-1');
    expect(service.deletePost).toHaveBeenCalledWith('post-1');
  });
});
