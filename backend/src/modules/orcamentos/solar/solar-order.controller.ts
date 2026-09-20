import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SolarOrderService, MAX_ORDER_PDF_BYTES } from './solar-order.service';

@ApiTags('Orçamentos - Sistema solar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/orcamentos/solar')
export class SolarOrderController {
  constructor(private readonly solarOrderService: SolarOrderService) {}

  /**
   * Lê um pedido de distribuidora e devolve um rascunho para conferência.
   *
   * Não cria nem altera orçamento nenhum — é leitura pura. A gravação só acontece quando
   * o usuário confirma os dados no wizard.
   */
  @Throttle(20, 900)
  @Post('parse-order')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ORDER_PDF_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Envie o pedido em PDF'), false);
        }
      },
    }),
  )
  async parseOrder(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado');
    }
    return this.solarOrderService.parseOrderPdf(file.buffer);
  }
}
