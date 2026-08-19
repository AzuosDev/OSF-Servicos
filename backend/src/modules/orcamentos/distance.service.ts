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

// Ponto que a ORS efetivamente escolheu para um endereço, com o rótulo completo que ela casou
// — devolvido ao app para que o usuário confira se é mesmo o lugar pretendido.
export type GeocodedPlace = GeoPoint & { label: string };

// Origem pode ser um endereço textual (geocodificado pela ORS) ou coordenadas diretas —
// útil para pontos de partida sem endereço formal (ex.: zona rural).
export type GeoOrigin = string | GeoPoint;

export type DistanceResult = {
  distanceKm: number;
  durationMin: number;
  travelCost: number;
  distanceCalculationId: Types.ObjectId;
  cached: boolean;
  // Opcional: cálculos gravados antes deste campo existir não têm o destino resolvido.
  resolvedDestination?: GeocodedPlace;
};

// Restringe a geocodificação ao Brasil: sem isso, nomes genéricos podem casar com
// homônimos no exterior.
const GEOCODE_COUNTRY = 'BRA';

// Endereços de praia e zona rural costumam cair fora da malha viária mapeada. O padrão da
// ORS é encaixar o ponto numa via a até 350 m, o que falha nesses casos; ampliamos esse raio.
const SNAP_RADIUS_METERS = 5000;

// Código da ORS para "não há via trafegável perto da coordenada".
const ORS_UNROUTABLE_POINT = 2010;

// A ORS devolve o motivo real dentro de um JSON aninhado — sem tratamento, o corpo cru da
// resposta vazava para a tela do usuário.
const orsErrorMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: number; message?: string } };
    if (parsed.error?.code === ORS_UNROUTABLE_POINT) {
      return 'Não foi possível traçar a rota: não há via mapeada nas proximidades de um dos pontos. Confira o endereço ou use um ponto de referência mais próximo de uma via.';
    }
    if (parsed.error?.message) {
      return `Falha na comunicação com a OpenRouteService: ${parsed.error.message}`;
    }
  } catch {
    // Corpo não-JSON: cai no retorno genérico abaixo.
  }
  return `Falha na comunicação com a OpenRouteService: ${body}`;
};

// Remonta o destino resolvido a partir do documento em cache. Registros gravados antes destes
// campos existirem simplesmente não têm o ponto — o app trata a ausência.
const resolvedDestinationOf = (doc: {
  resolvedDestinationLabel?: string;
  resolvedDestinationLat?: number;
  resolvedDestinationLon?: number;
}): GeocodedPlace | undefined => {
  const { resolvedDestinationLabel: label, resolvedDestinationLat: lat, resolvedDestinationLon: lon } = doc;
  return label && lat != null && lon != null ? { label, lat, lon } : undefined;
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
      throw new BadRequestException(orsErrorMessage(body));
    }

    return response.json() as Promise<T>;
  }

  /**
   * `focus` prioriza resultados próximos a esse ponto. Nomes de praias e localidades se repetem
   * pelo país (ex.: "Praia da Baleia" existe no CE, em SP e na BA) e, sem esse viés, a ORS
   * devolve a homônima mais bem ranqueada — que pode estar a milhares de km da origem.
   */
  private async geocode(address: string, focus?: GeoPoint): Promise<GeocodedPlace> {
    const params = new URLSearchParams({
      text: address,
      size: '1',
      'boundary.country': GEOCODE_COUNTRY,
    });
    if (focus) {
      params.set('focus.point.lat', String(focus.lat));
      params.set('focus.point.lon', String(focus.lon));
    }

    const result = await this.orsFetch<{
      features: { geometry: { coordinates: [number, number] }; properties?: { label?: string } }[];
    }>(`/geocode/search?${params.toString()}`);
    if (!result.features || result.features.length === 0) {
      throw new NotFoundException(`Endereço não encontrado: ${address}`);
    }
    const feature = result.features[0];
    const [lon, lat] = feature.geometry.coordinates;
    // `label` é o endereço completo que a ORS casou (ex.: "Praia da Baleia, Itapipoca, CE, Brasil");
    // sem ele, cai no texto pesquisado.
    return { label: feature.properties?.label?.trim() || address, lat, lon };
  }

  private async resolvePoint(origin: GeoOrigin): Promise<GeoPoint> {
    return isGeoPoint(origin) ? origin : this.geocode(origin);
  }

  private async directions(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
  ): Promise<{ distanceKm: number; durationMin: number }> {
    const result = await this.orsFetch<{ routes?: { summary: { distance: number; duration: number } }[] }>(
      '/v2/directions/driving-car',
      {
        method: 'POST',
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
          radiuses: [SNAP_RADIUS_METERS, SNAP_RADIUS_METERS],
        }),
      },
    );
    // Resposta 200 sem rota é possível; sem essa checagem estourava um TypeError cru (500).
    const summary = result.routes?.[0]?.summary;
    if (!summary) {
      throw new NotFoundException('A OpenRouteService não encontrou rota entre a origem e o destino informados');
    }
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
    const cachedDestination = cached ? resolvedDestinationOf(cached) : undefined;

    if (cached && cachedDestination) {
      const travelCost = computeTravelCost(cached.distanceKm, pricing);
      return {
        distanceKm: cached.distanceKm,
        durationMin: cached.durationMin,
        travelCost,
        distanceCalculationId: cached._id as Types.ObjectId,
        cached: true,
        resolvedDestination: cachedDestination,
      };
    }

    // Registro anterior a este campo existir: servi-lo deixaria a conferência do destino
    // invisível no app até o cache expirar (30 dias). Descartamos para recalcular uma vez.
    if (cached) {
      await this.distanceCalculationModel.findByIdAndDelete(cached._id).exec();
    }

    const originPoint = await this.resolvePoint(origin);
    const destination = await this.geocode(destinationAddress, originPoint);
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
      resolvedDestinationLabel: destination.label,
      resolvedDestinationLat: destination.lat,
      resolvedDestinationLon: destination.lon,
    });

    return {
      distanceKm,
      durationMin,
      travelCost,
      distanceCalculationId: record._id as Types.ObjectId,
      cached: false,
      resolvedDestination: destination,
    };
  }
}
