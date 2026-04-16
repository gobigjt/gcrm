import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HrService }    from './hr.service';

function sessionUserId(user: { id?: unknown }): number {
  const uid = Number(user?.id);
  if (!Number.isInteger(uid) || uid < 1) throw new UnauthorizedException();
  return uid;
}

@ApiTags('HR')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin','HR','Manager')
@Controller('hr')
export class HrController {
  constructor(private readonly svc: HrService) {}

  @Get('employees')       listEmployees(@CurrentUser() u: any)     { return this.svc.listEmployees(u); }
  @Post('employees')      createEmployee(@Body() b: any, @CurrentUser() u: any) { return this.svc.createEmployee(b, u); }
  @Get('employees/:id')   async getEmployee(@Param('id') id: string, @CurrentUser() u: any) { const e=await this.svc.getEmployee(Number(id), u); if(!e) throw new NotFoundException(); return {employee:e}; }
  @Patch('employees/:id') updateEmployee(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.updateEmployee(Number(id), b, u); }
  @Get('employees/:id/attendance') getAttendance(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string, @CurrentUser() u?: any) {
    return this.svc.getAttendance(Number(id), from, to, u);
  }

  @Post('attendance')         markAttendance(@Body() b: any, @CurrentUser() u: any) { return this.svc.markAttendance(b, u); }

  /** Sales Executive: today’s row + whether an employee profile exists (no HR screen access required). */
  @Get('me/attendance/today')
  @Roles('Sales Executive', 'Sales Manager')
  async myAttendanceToday(@CurrentUser() user: { id: number }) {
    const attendance = await this.svc.getTodayAttendanceByUserId(sessionUserId(user), user);
    return { employeeLinked: true, attendance };
  }

  @Post('me/attendance/check-in')
  @Roles('Sales Executive', 'Sales Manager')
  async myCheckIn(@CurrentUser() user: { id: number }) {
    return { attendance: await this.svc.selfCheckIn(sessionUserId(user), user) };
  }

  @Post('me/attendance/check-out')
  @Roles('Sales Executive', 'Sales Manager')
  async myCheckOut(@CurrentUser() user: { id: number }) {
    return { attendance: await this.svc.selfCheckOut(sessionUserId(user), user) };
  }

  @Get('attendance/summary')  getAttendanceSummary(@Query('from') from: string, @Query('to') to: string, @CurrentUser() u: any) {
    if(!from||!to) throw new BadRequestException('from and to required');
    return this.svc.getAttendanceSummary(from, to, u);
  }

  @Get('attendance/records')
  listAttendanceRecords(@Query('from') from: string, @Query('to') to: string, @CurrentUser() u: any) {
    if (!from || !to) throw new BadRequestException('from and to required');
    return this.svc.listAttendanceRecords(from, to, u);
  }

  @Get('payroll')          listPayroll(@Query('month') m: string, @Query('year') y: string, @CurrentUser() u: any) {
    if(!m||!y) throw new BadRequestException('month and year required');
    return this.svc.listPayroll(Number(m), Number(y), u);
  }
  @Post('payroll')         createPayroll(@Body() b: any, @CurrentUser() u: any) { return this.svc.createPayroll(b, u); }
  @Patch('payroll/:id/process') processPayroll(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.processPayroll(Number(id), u); }
  @Patch('payroll/:id/pay')     payPayroll(@Param('id') id: string, @CurrentUser() u: any)     { return this.svc.payPayroll(Number(id), u); }
}
