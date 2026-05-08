import { Controller, Get } from '@nestjs/common';

/** ----- Handle prisma module endpoints. ----- **/
@Controller('internal/prisma')
export class PrismaController {
  /** ----- Get prisma module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'prisma' } as const;
  }
}
