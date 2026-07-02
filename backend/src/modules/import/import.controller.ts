import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { ImportService } from './import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Throttle(10, 900)
  @Post('ofx/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase();
        if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
          cb(null, true);
        } else {
          cb(new Error('Apenas arquivos .ofx ou .qfx são aceitos'), false);
        }
      },
    }),
  )
  async preview(
    @CurrentUser() user: ICurrentUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('carteiraId') carteiraId: string,
  ) {
    if (!file) throw new Error('Arquivo não enviado');
    return this.importService.preview(user._id.toString(), carteiraId, file.buffer);
  }

  @Post('ofx/confirm')
  async confirm(@CurrentUser() user: ICurrentUser, @Body() dto: ConfirmImportDto) {
    return this.importService.confirm(user._id.toString(), dto);
  }

  @Get('batches')
  async listBatches(
    @CurrentUser() user: ICurrentUser,
    @Query('carteiraId') carteiraId?: string,
  ) {
    return this.importService.listBatches(user._id.toString(), carteiraId);
  }

  @Delete('batches/:batchId')
  async deleteBatch(@CurrentUser() user: ICurrentUser, @Param('batchId') batchId: string) {
    return this.importService.deleteBatch(user._id.toString(), batchId);
  }
}
