import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebAuthnCredentialDocument = WebAuthnCredential & Document;

@Schema({ timestamps: true })
export class WebAuthnCredential {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  credentialId!: string;

  @Prop({ required: true })
  publicKey!: string; // base64url-encoded COSE key

  @Prop({ required: true, default: 0 })
  counter!: number;

  @Prop()
  deviceType?: string;

  @Prop({ default: false })
  backedUp!: boolean;

  @Prop({ type: [String], default: [] })
  transports!: string[];
}

export const WebAuthnCredentialSchema = SchemaFactory.createForClass(WebAuthnCredential);
WebAuthnCredentialSchema.index({ userId: 1 });
WebAuthnCredentialSchema.index({ credentialId: 1 }, { unique: true });
