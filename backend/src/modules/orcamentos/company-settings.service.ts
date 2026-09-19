import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompanySettings, CompanySettingsDocument } from './schemas/company-settings.schema';
import { CompanySettingsDto } from './dto/company-settings.dto';
import { GeoOrigin } from './distance.service';

// Usa coordenadas diretas quando cadastradas (endereço rural/sem numeração formal),
// senão volta a geocodificar o endereço textual da empresa. A validação do DTO garante
// que pelo menos um dos dois esteja preenchido — o throw aqui é defesa em profundidade.
export const companyOrigin = (settings: Pick<CompanySettings, 'baseAddress' | 'originLat' | 'originLng'>): GeoOrigin => {
  if (settings.originLat != null && settings.originLng != null) {
    return { lat: settings.originLat, lon: settings.originLng };
  }
  if (!settings.baseAddress) {
    throw new BadRequestException('Configure o endereço de partida ou as coordenadas da empresa');
  }
  return settings.baseAddress;
};

/** Garantias que o formulário pode esvaziar — ver o comentário em `upsert`. */
const CLEARABLE_WARRANTY_FIELDS = [
  'panelEfficiencyWarrantyYears',
  'panelDefectWarrantyYears',
  'inverterWarrantyYears',
  'installationWarrantyYears',
] as const satisfies readonly (keyof CompanySettingsDto)[];

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectModel(CompanySettings.name) private companySettingsModel: Model<CompanySettingsDocument>,
  ) {}

  async get(userId: string) {
    const settings = await this.companySettingsModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!settings) {
      throw new NotFoundException('Configure os dados da empresa antes de criar orçamentos');
    }
    return settings;
  }

  async findRaw(userId: string) {
    return this.companySettingsModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async upsert(userId: string, dto: CompanySettingsDto) {
    // Um campo opcional ausente no DTO não chega ao `$set` — o class-transformer nem cria a
    // chave — então sem `$unset` o valor anterior sobreviveria à limpeza do formulário. Para
    // as garantias isso seria grave: o PDF continuaria prometendo ao cliente um prazo que a
    // empresa acabou de apagar. Restrito às garantias de propósito; os outros campos
    // opcionais têm o mesmo comportamento hoje e mudá-los está fora desta entrega.
    const toUnset = CLEARABLE_WARRANTY_FIELDS.filter((field) => dto[field] == null);

    const update: Record<string, unknown> = {
      $set: dto,
      $setOnInsert: { userId: new Types.ObjectId(userId) },
    };
    if (toUnset.length > 0) {
      update.$unset = Object.fromEntries(toUnset.map((field) => [field, '']));
    }

    return this.companySettingsModel
      .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, update, {
        upsert: true,
        new: true,
        runValidators: true,
      })
      .exec();
  }
}
