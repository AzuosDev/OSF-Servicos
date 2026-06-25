import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}

  private toObjectId(value: string, field: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`${field} must be a valid ObjectId`);
    return new Types.ObjectId(value);
  }

  async create(userId: string, dto: CreateWalletDto) {
    return this.walletModel.create({
      userId: this.toObjectId(userId, 'userId'),
      nome: dto.nome,
      saldo: dto.saldo ?? 0,
      icone: dto.icone,
    });
  }

  async findAll(userId: string) {
    return this.walletModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: 1 }).exec();
  }

  async findOne(userId: string, id: string) {
    const wallet = await this.walletModel.findOne({
      _id: this.toObjectId(id, 'id'),
      userId: this.toObjectId(userId, 'userId'),
    }).exec();

    if (!wallet) throw new NotFoundException('Carteira não encontrada');

    const transactions = await this.transactionModel
      .find({ userId: new Types.ObjectId(userId), carteiraId: wallet._id })
      .sort({ date: -1 })
      .limit(20)
      .exec();

    return { ...wallet.toObject(), transactions };
  }

  async update(userId: string, id: string, dto: UpdateWalletDto) {
    const wallet = await this.walletModel.findOne({
      _id: this.toObjectId(id, 'id'),
      userId: this.toObjectId(userId, 'userId'),
    }).exec();

    if (!wallet) throw new NotFoundException('Carteira não encontrada');

    if (dto.nome !== undefined) wallet.nome = dto.nome;
    if (dto.icone !== undefined) wallet.icone = dto.icone;
    if (typeof dto.saldo === 'number') wallet.saldo = dto.saldo;

    await wallet.save();
    return wallet;
  }

  async remove(userId: string, id: string) {
    const wallet = await this.walletModel.findOneAndDelete({
      _id: this.toObjectId(id, 'id'),
      userId: this.toObjectId(userId, 'userId'),
    }).exec();

    if (!wallet) throw new NotFoundException('Carteira não encontrada');
    return { deleted: true };
  }

  async transfer(userId: string, dto: TransferWalletDto) {
    if (dto.carteiraOrigemId === dto.carteiraDestinoId) {
      throw new BadRequestException('Carteiras de origem e destino devem ser diferentes');
    }

    const userObjectId = this.toObjectId(userId, 'userId');
    const [origem, destino] = await Promise.all([
      this.walletModel.findOne({ _id: this.toObjectId(dto.carteiraOrigemId, 'carteiraOrigemId'), userId: userObjectId }).exec(),
      this.walletModel.findOne({ _id: this.toObjectId(dto.carteiraDestinoId, 'carteiraDestinoId'), userId: userObjectId }).exec(),
    ]);

    if (!origem) throw new NotFoundException('Carteira de origem não encontrada');
    if (!destino) throw new NotFoundException('Carteira de destino não encontrada');
    if (origem.saldo < dto.value) throw new BadRequestException('Saldo insuficiente na carteira de origem');

    origem.saldo -= dto.value;
    destino.saldo += dto.value;

    await Promise.all([
      origem.save(),
      destino.save(),
      // Registra a transferência como transações neutras para rastreabilidade
      this.transactionModel.create([
        {
          userId: userObjectId,
          type: TransactionType.TRANSFER,
          tipoTransacao: 'transferencia',
          value: dto.value,
          date: new Date(dto.date),
          description: dto.description ?? `Transferência para ${destino.nome}`,
          carteiraId: origem._id,
          carteiraDestinoId: destino._id,
        },
      ]),
    ]);

    return {
      origem: { id: origem._id, nome: origem.nome, saldo: origem.saldo },
      destino: { id: destino._id, nome: destino.nome, saldo: destino.saldo },
    };
  }
}
