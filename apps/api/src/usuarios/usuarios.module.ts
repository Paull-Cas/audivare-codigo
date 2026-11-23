import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { PerfilController } from './perfil.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  controllers: [UsuariosController, PerfilController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
