import { IsNotEmpty, IsString, IsNumber, Min, Max, Matches, IsOptional, IsBoolean } from 'class-validator';

export class CreateNodeDto {
  @IsNotEmpty({ message: 'Node Name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Node Port is required' })
  @IsNumber()
  @Min(1, { message: 'Port must be between 1 and 65535' })
  @Max(65535, { message: 'Port must be between 1 and 65535' })
  port: number;

  @IsNotEmpty({ message: 'Node ID is required' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Node ID must only contain letters, numbers, underscores, and dashes (URL safe)',
  })
  id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  strip_prefix?: boolean;
}

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  strip_prefix?: boolean;
}
