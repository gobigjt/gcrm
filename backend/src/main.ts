import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import * as morgan from 'morgan';

async function bootstrap() {
  const uploadRoot = join(process.cwd(), 'uploads');
  const companyDir = join(uploadRoot, 'company');
  const usersDir = join(uploadRoot, 'users');
  if (!existsSync(companyDir)) mkdirSync(companyDir, { recursive: true });
  if (!existsSync(usersDir)) mkdirSync(usersDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // CORS must apply to static `/uploads/*` (Flutter web loads profile images cross-origin).
  app.enableCors();
  app.useStaticAssets(uploadRoot, {
    prefix: '/uploads/',
    index: false,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(morgan('dev'));

  // ── Swagger ──────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('EzCRM API')
    .setDescription(
      'REST API for EzCRM platform.\n\n' +
      'Authenticate via **POST /api/auth/login**, copy the `access_token`, ' +
      'then click **Authorize** and enter `Bearer <token>`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('Auth',          'Authentication — register, login, refresh, logout')
    .addTag('Users',         'User accounts, roles & permissions management')
    .addTag('CRM',           'Lead management, activities, follow-ups')
    .addTag('Lead Capture',  'Public lead capture form submission (no auth required)')
    .addTag('Sales',         'Customers, proposals, quotations, orders, invoices, payments')
    .addTag('Purchase',      'Vendors, purchase orders, GRNs, purchase invoices')
    .addTag('Inventory',     'Products, warehouses, stock levels, movements')
    .addTag('Production',    'Bill of Materials, work orders')
    .addTag('Finance',       'Accounts, journals, expenses, P&L, GST reports')
    .addTag('HR',            'Employees, attendance, payroll')
    .addTag('Communication', 'Message templates and communication logs')
    .addTag('Settings',      'Company settings, module access, audit logs')
    .addTag('Tenants',       'Super Admin tenant account management')
    .addTag('Export',        'CSV export for leads, invoices, employees, stock')
    .addTag('Notifications', 'Per-user notification feed')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'EzCRM API Docs',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
