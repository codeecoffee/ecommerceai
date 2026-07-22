import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashingService {
  private readonly saltRounds = 10;

  public async hash(plainText: string): Promise<string> {
    return await bcrypt.hash(plainText, 10);
  }
  public async comparePassword(plainText: string, hashPass: string): Promise<boolean> {
    return await bcrypt.compare(plainText, hashPass);
  }
}
