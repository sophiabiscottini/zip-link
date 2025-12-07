import { IsUrl, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUrlDto {
  @IsUrl({}, { message: 'Please provide a valid URL' })
  url: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Custom alias must be at least 3 characters' })
  @MaxLength(20, { message: 'Custom alias must be at most 20 characters' })
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'Custom alias can only contain letters, numbers, hyphens, and underscores',
  })
  customAlias?: string;
}
