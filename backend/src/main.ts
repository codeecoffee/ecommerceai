import 'dotenv/config'
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  //this allows @Expose() / @Exclude() in resp dtos to work
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));  
  // main.ts (global) or per-controller
  /** 
   * Swagger config
   * 
  */
 const config = new DocumentBuilder()
 .setTitle('Ecommerce Store')
 .setDescription('Use the base API URL as http://localhost:3000')
 .setTermsOfService('http://localhost:3000/terms-of-service')
 .setLicense('MIT LICENSE', 'https://github.com/git/git-scm.com/blob/main/MIT-LICENSE.txt')
 .setVersion('1.0')
 .addServer('http://localhost:3000')
 .build()
 const doc = SwaggerModule.createDocument(app, config)
 SwaggerModule.setup('documentation',app, doc)

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
