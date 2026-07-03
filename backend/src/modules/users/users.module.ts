import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { Goal, GoalSchema } from '../goals/schemas/goal.schema';
import { PendingAccount, PendingAccountSchema } from '../pending/schemas/pending-account.schema';
import { WebAuthnModule } from '../webauthn/webauthn.module';

@Global()
@Module({
  imports: [
    WebAuthnModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Goal.name, schema: GoalSchema },
      { name: PendingAccount.name, schema: PendingAccountSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
