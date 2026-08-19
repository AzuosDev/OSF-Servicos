import { BadRequestException, Injectable, Logger, NotFoundException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DistanceCalculation, DistanceCalculationDocument } from './schemas/distance-calculation.schema';

export type TravelPricing = {
  pricePerKm: number;
  minimumTravelFee: number;
  freeRadiusKm: number;
};

export type GeoPoint = { lat: number; lon: number };

// Origem pode ser um endereço textual (geocodificado pela ORS) ou coordenadas diretas —
// útil para pontos de partida sem endereço formal (ex.: zona rural).
export type GeoOrigin = string | GeoPoint;

export type DistanceResult = {
  distanceKm: number;
  durationMin: number;
  travelCost: number;
  distanceCalculationId: Types.ObjectId;
  cached: boolean;
};

const normalize = (address: string) => address.trim().toLowerCase().replace(/\s+/g, ' ');

const isGeoPoint = (origin: GeoOrigin): origin is GeoPoint => typeof origin === 'object';

// Rótulo estável de uma origem, usado tanto na chave de cache quanto no registro salvo,
// independente de ser um endereço textual ou coordenadas diretas.
const originLabel = (origin: GeoOrigin): string =>
  isGeoPoint(origin) ? `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}` : origin;

const computeTravelCost = (distanceKm: number, pricing: TravelPricing): number => {
  if (distanceKm < pricing.freeRadiusKm) {
    return 0;
  }
  // distanceKm é o trajeto de ida (retornado pela ORS); o custo cobra ida e volta.
  const roundTripKm = distanceKm * 2;
  return Math.max(pricing.minimumTravelFee, roundTripKm * pricing.pricePerKm);
};

@Injectable()
export class DistanceService {
  private readonly logger = new Logger(DistanceService.name);
  private readonly orsApiKey: string | null;
  private readonly orsUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(DistanceCalculation.name)
    private readonly distanceCalculationModel: Model<DistanceCalculationDocument>,
  ) {
    this.orsApiKey = this.configService.get<string>('ORS_API_KEY') ?? null;
    this.orsUrl = this.configService.get<string>('ORS_URL') ?? 'https://api.openrouteservice.org';
  }

  private getApiKey(): string {
    if (!this.orsApiKey) {
      throw new BadRequestException(
        'Cálculo de distância indisponível: chave da OpenRouteService não configurada nesta instância',
      );
    }
    return this.orsApiKey;
  }

  private async orsFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const apiKey = this.getApiKey();
    let response: Response;
    try {
      response = await fetch(`${this.orsUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json; charset=utf-8',
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new RequestTimeoutException('Tempo limite excedido ao consultar a OpenRouteService, tente novamente');
      }
      this.logger.error('Falha de rede ao consultar a OpenRouteService', error as Error);
      throw new BadRequestException('Falha de rede ao consultar a OpenRouteService');
    }

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) {
        throw new BadRequestException('Cota/limite de requisições da OpenRouteService excedido, tente novamente mais tarde');
      }
      throw new BadRequestException(`Falha na comunicação com a OpenRouteService: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private async geocode(address: string): Promise<GeoPoint> {
    const result = await this.orsFetch<{ features: { geometry: { coordinates: [number, number] } }[] }>(
      `/geocode/search?text=${encodeURIComponent(address)}&size=1`,
    );
    if (!result.features || result.features.length === 0) {
      throw new NotFoundException(`Endereço não encontrado: ${address}`);
    }
    const [lon, lat] = result.features[0].geometry.coordinates;
    return { lat, lon };
  }

  private async resolvePoint(origin: GeoOrigin): Promise<GeoPoint> {
    return isGeoPoint(origin) ? origin : this.geocode(origin);
  }

  private async directions(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
  ): Promise<{ distanceKm: number; durationMin: number }> {
    const result = await this.orsFetch<{ routes: { summary: { distance: number; duration: number } }[] }>(
      '/v2/directions/driving-car',
      {
        method: 'POST',
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
        }),
      },
    );
    const summary = result.routes[0].summary;
    return { distanceKm: summary.distance / 1000, durationMin: summary.duration / 60 };
  }

  async calculate(
    userId: string,
    origin: GeoOrigin,
    destinationAddress: string,
    pricing: TravelPricing,
  ): Promise<DistanceResult> {
    const originAddress = originLabel(origin);
    const cacheKey = `${normalize(originAddress)}|${normalize(destinationAddress)}`;
    const userObjectId = new Types.ObjectId(userId);

    const cached = await this.distanceCalculationModel.findOne({ userId: userObjectId, cacheKey }).exec();
    if (cached) {
      const travelCost = computeTravelCost(cached.distanceKm, pricing);
      return {
        distanceKm: cached.distanceKm,
        durationMin: cached.durationMin,
        travelCost,
        distanceCalculationId: cached._id as Types.ObjectId,
        cached: true,
      };
    }

    const originPoint = await this.resolvePoint(origin);
    const destination = await this.geocode(destinationAddress);
    const { distanceKm, durationMin } = await this.directions(originPoint, destination);
    const travelCost = computeTravelCost(distanceKm, pricing);

    const record = await this.distanceCalculationModel.create({
      userId: userObjectId,
      originAddress,
      destinationAddress,
      cacheKey,
      distanceKm,
      durationMin,
      travelCost,
    });

    return {
      distanceKm,
      durationMin,
      travelCost,
      distanceCalculationId: record._id as Types.ObjectId,
      cached: false,
    };
  }
}
