import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches, MaxLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Industries Pvt Ltd' })
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'acme-industries' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  slug?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
