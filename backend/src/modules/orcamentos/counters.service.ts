import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter, CounterDocument } from './schemas/counter.schema';

@Injectable()
export class CountersService {
  constructor(@InjectModel(Counter.name) private counterModel: Model<CounterDocument>) {}

  async getNextSequence(key: string): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true })
      .exec();
    return counter.seq;
  }
}
