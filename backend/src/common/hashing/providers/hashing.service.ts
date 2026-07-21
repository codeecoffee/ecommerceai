import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashingService {
  private readonly saltRounds = 10;
  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, 10);
  }
  async comparePassword(plainText: string, hashPass: string): Promise<boolean> {
    return bcrypt.compare(plainText, hashPass);
  }
}
