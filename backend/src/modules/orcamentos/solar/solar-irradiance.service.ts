import { BadRequestException, Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolarIrradiance, SolarIrradianceDocument } from '../schemas/solar-irradiance.schema';

/**
 * Irradiação solar média mensal (HSP, em kWh/m²/dia) de um ponto do mapa.
 *
 * Fonte: NASA POWER — pública, sem chave de API e sem custo. O endpoint de *climatologia*
 * devolve a normal de cada mês, que é exatamente o que uma proposta comercial precisa: a
 * média histórica do local, não a medição de um ano específico.
 *
 * É daqui que sai a variação do gráfico anual. O período chuvoso da região já está embutido
 * no dado medido — não existe, e não deve existir, fator sazonal artificial no cálculo.
 */

const DEFAULT_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/climatology/point';

/** Ordem em que a NASA devolve os meses. */
const NASA_MONTH_KEYS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** Irradiância global horizontal no plano — o parâmetro que vira HSP direto. */
const NASA_PARAMETER = 'ALLSKY_SFC_SW_DWN';

/** A NASA marca dado ausente com -999, não com null. */
const NASA_FILL_VALUE = -999;

/**
 * Duas casas decimais ≈ 1,1 km. Clientes da mesma rua, do mesmo bairro e quase sempre da
 * mesma cidade caem na mesma chave, então o cache é reaproveitado de verdade em vez de
 * gerar uma linha nova por endereço.
 */
export function irradianceCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

type NasaPowerResponse = {
  properties?: {
    parameter?: {
      [key: string]: Record<string, number> | undefined;
    };
  };
};

@Injectable()
export class SolarIrradianceService {
  private readonly logger = new Logger(SolarIrradianceService.name);
  private readonly powerUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(SolarIrradiance.name)
    private readonly irradianceModel: Model<SolarIrradianceDocument>,
  ) {
    this.powerUrl = this.configService.get<string>('NASA_POWER_URL') ?? DEFAULT_POWER_URL;
  }

  /**
   * Os 12 valores de irradiação do ponto, janeiro a dezembro. Consulta a NASA só na primeira
   * vez para cada coordenada; depois vem do cache.
   */
  async getMonthlyIrradiance(lat: number, lon: number): Promise<number[]> {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('Latitude inválida para consulta de irradiação');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new BadRequestException('Longitude inválida para consulta de irradiação');
    }

    const cacheKey = irradianceCacheKey(lat, lon);

    const cached = await this.irradianceModel.findOne({ cacheKey }).exec();
    if (cached) {
      return cached.monthly;
    }

    const monthly = await this.fetchFromNasaPower(lat, lon);

    // Corrida entre dois orçamentos no mesmo ponto grava a mesma coisa duas vezes; o upsert
    // resolve sem estourar o índice único, e o dado é idêntico de qualquer forma.
    await this.irradianceModel
      .findOneAndUpdate(
        { cacheKey },
        { $setOnInsert: { cacheKey, lat, lon, monthly, source: 'NASA POWER climatology' } },
        { upsert: true, new: true },
      )
      .exec();

    return monthly;
  }

  private async fetchFromNasaPower(lat: number, lon: number): Promise<number[]> {
    const params = new URLSearchParams({
      parameters: NASA_PARAMETER,
      community: 'RE',
      latitude: String(lat),
      longitude: String(lon),
      format: 'JSON',
    });

    let response: Response;
    try {
      response = await fetch(`${this.powerUrl}?${params.toString()}`, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new RequestTimeoutException(
          'Tempo limite excedido ao consultar a irradiação solar do local, tente novamente',
        );
      }
      this.logger.error('Falha de rede ao consultar a NASA POWER', error as Error);
      throw new BadRequestException('Falha de rede ao consultar a irradiação solar do local');
    }

    if (!response.ok) {
      this.logger.error(`NASA POWER respondeu ${response.status} para ${lat},${lon}`);
      throw new BadRequestException('Não foi possível obter a irradiação solar do local');
    }

    const body = (await response.json()) as NasaPowerResponse;
    return parseNasaPowerMonthly(body);
  }
}

/**
 * Extrai os doze meses da resposta da NASA.
 *
 * Exportada para teste: é aqui que mora o risco real — um formato inesperado tem que virar
 * erro claro, nunca um array meio preenchido que acabaria impresso como geração no PDF.
 */
export function parseNasaPowerMonthly(body: NasaPowerResponse): number[] {
  const parameter = body?.properties?.parameter?.[NASA_PARAMETER];

  if (!parameter || typeof parameter !== 'object') {
    throw new BadRequestException('Resposta de irradiação solar em formato inesperado');
  }

  return NASA_MONTH_KEYS.map((key) => {
    const value = parameter[key];

    if (typeof value !== 'number' || !Number.isFinite(value) || value === NASA_FILL_VALUE || value < 0) {
      throw new BadRequestException(`Irradiação solar indisponível para o local (mês ${key})`);
    }

    return value;
  });
}
