import { IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, MaxLength, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

const clean = (value: unknown) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value);

// Endereço e coordenadas são duas formas alternativas de informar o ponto de partida —
// pelo menos uma delas precisa estar completa (endereço rural sem numeração formal usa
// só coordenadas; endereço urbano normal dispensa coordenadas).
const hasCoordinates = (dto: CompanySettingsDto) => dto.originLat != null && dto.originLng != null;
const hasAddress = (dto: CompanySettingsDto) => Boolean(dto.baseAddress && dto.baseAddress.trim());

export class CompanySettingsDto {
  @IsNotEmpty()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(150)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @ValidateIf((dto: CompanySettingsDto) => !hasCoordinates(dto))
  @IsNotEmpty({ message: 'Informe o endereço de partida ou as coordenadas (latitude e longitude)' })
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(300)
  baseAddress?: string;

  @ValidateIf((dto: CompanySettingsDto) => !hasAddress(dto))
  @IsNotEmpty({ message: 'Informe a latitude ou o endereço de partida' })
  @IsLatitude()
  @Type(() => Number)
  originLat?: number;

  @ValidateIf((dto: CompanySettingsDto) => !hasAddress(dto))
  @IsNotEmpty({ message: 'Informe a longitude ou o endereço de partida' })
  @IsLongitude()
  @Type(() => Number)
  originLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(100)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoUrl?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerKm!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumTravelFee!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  freeRadiusKm!: number;

  // Garantias do sistema fotovoltaico — anos inteiros. Opcionais: quem não vende sistema
  // solar nunca preenche, e o orçamento de venda solar só imprime o que estiver configurado.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  panelEfficiencyWarrantyYears?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  panelDefectWarrantyYears?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  inverterWarrantyYears?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  installationWarrantyYears?: number;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(1000)
  pdfFooterNote?: string;
}
