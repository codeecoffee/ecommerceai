import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './providers/posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';

/**
 * NOTE on scope, this is the important part: this test calls
 * controller.createPost(productId, dto, currentUser) DIRECTLY. That means
 * it never goes through Nest's actual request pipeline -- no @Param
 * validation, no ParseUUIDPipe, and critically, no @CurrentUser()
 * resolution. We are HANDING the controller the resolved arguments
 * ourselves.
 *
 * That means this test structurally CANNOT catch a bug like the
 * @Query()-instead-of-@CurrentUser() mistake you found before -- both the
 * buggy and correct decorator would produce an identical unit test result,
 * because we never let Nest resolve the decorator at all. Catching that
 * class of bug requires an integration or e2e test that goes in over real
 * HTTP. This file is still valuable (it proves the controller talks to the
 * service correctly), just narrower than it might feel.
 *
 * The guard overrides below exist for a different reason than "we don't
 * trust the guards" -- Nest instantiates every class referenced by
 * @UseGuards() as soon as the TestingModule compiles, regardless of
 * whether an HTTP server ever runs. OwnershipOrAdminGuard needs a real
 * DatabaseService to construct, which this test correctly has no reason
 * to provide (that's posts.integration.spec.ts's job). Overriding the
 * guards here just lets module compilation succeed; it says nothing about
 * whether the guards themselves are correct.
 */
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnershipOrAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PostsController);
  });

  it('createPost passes productId, the dto, and the current user id through to the service', async () => {
    const dto = {
      title: 'Solid product',
      rating: 5,
      comment: 'nice product',
    } as any;
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
    const dto = { comment: 'edited' } as any;

    await controller.updatePost('post-1', dto);

    expect(service.updatePost).toHaveBeenCalledWith('post-1', dto);
  });

  it('deletePost forwards postId', async () => {
    await controller.deletePost('post-1');
    expect(service.deletePost).toHaveBeenCalledWith('post-1');
  });
});
