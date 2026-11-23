import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  async getResumen(@Request() req: RequestConUsuario) {
    return this.dashboardService.getResumen(req.user.id);
  }

  @Get('onboarding')
  async getOnboarding(@Request() req: RequestConUsuario) {
    return this.dashboardService.getOnboarding(req.user.id);
  }
}
