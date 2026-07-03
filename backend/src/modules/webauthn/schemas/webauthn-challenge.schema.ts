import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebAuthnChallengeDocument = WebAuthnChallenge & Document;

@Schema({ timestamps: true })
export class WebAuthnChallenge {
  @Prop({ required: true })
  challenge!: string;

  @Prop({ required: true, enum: ['register', 'login', 'reauth'] })
  type!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop()
  email?: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  reauthedToken?: string;
}

export const WebAuthnChallengeSchema = SchemaFactory.createForClass(WebAuthnChallenge);
// TTL index: MongoDB removes expired challenges automatically
WebAuthnChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
