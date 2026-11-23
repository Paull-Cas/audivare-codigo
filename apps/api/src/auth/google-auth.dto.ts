import { IsString, Length, Matches, IsIn, ValidateIf, Equals } from 'class-validator';

export class GoogleLoginDto {
  // ID token emitido por Google Identity Services
  @IsString({ message: 'La credencial de Google es requerida' })
  @Length(1, 8192)
  credential!: string;
}

export class GoogleRegistroDto {
  @Equals(true, { message: 'Debes aceptar los términos de uso' })
  acepta_terminos!: boolean;

  @Equals(true, { message: 'Debes leer la política de privacidad' })
  privacidad_leida!: boolean;

  @IsString()
  @Length(1, 40)
  version_legal!: string;

  @ValidateIf(o => o.tipo === 'EMPRESA')
  @Equals(true, { message: 'Confirma que puedes representar a la empresa' })
  declara_representacion?: boolean;

  @IsString({ message: 'La credencial de Google es requerida' })
  @Length(1, 8192)
  credential!: string;

  @IsString()
  @Length(1, 200)
  nombre_completo!: string;

  @IsIn(['EMPRESA', 'CONTADOR'], { message: 'Tipo de usuario inválido' })
  tipo!: 'EMPRESA' | 'CONTADOR';

  @ValidateIf((o) => o.tipo === 'EMPRESA')
  @IsString()
  @Length(11, 11, { message: 'El RUC debe tener 11 dígitos' })
  @Matches(/^[0-9]+$/, { message: 'El RUC solo debe contener números' })
  ruc?: string;

  @ValidateIf((o) => o.tipo === 'EMPRESA')
  @IsString()
  @Length(1, 200)
  razon_social?: string;
}
