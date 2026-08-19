import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(@InjectModel(Client.name) private clientModel: Model<ClientDocument>) {}

  async create(userId: string, dto: CreateClientDto) {
    return this.clientModel.create({ ...dto, userId: new Types.ObjectId(userId) });
  }

  async findAll(userId: string, activeOnly = false) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (activeOnly) {
      filter.active = true;
    }
    return this.clientModel.find(filter).sort({ name: 1 }).exec();
  }

  async findOne(userId: string, id: string) {
    const client = await this.clientModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .exec();
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return client;
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    const client = await this.findOne(userId, id);
    Object.assign(client, dto);
    await client.save();
    return client;
  }

  async remove(userId: string, id: string) {
    const client = await this.findOne(userId, id);
    await client.deleteOne();
    return { deleted: true };
  }
}
