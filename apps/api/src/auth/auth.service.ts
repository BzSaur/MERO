import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

interface IntentoFallido {
  count: number;
  bloqueadoHasta?: Date;
}

@Injectable()
export class AuthService {
  private intentosFallidos = new Map<string, IntentoFallido>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const ahora = new Date();

    const intento = this.intentosFallidos.get(email);
    if (intento?.bloqueadoHasta && intento.bloqueadoHasta > ahora) {
      const minutosRestantes = Math.ceil(
        (intento.bloqueadoHasta.getTime() - ahora.getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s).`,
      );
    }

    const user = await this.prisma.meroUsuario.findUnique({
      where: { email },
    });

    if (!user) {
      this.registrarIntentoFallido(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.registrarIntentoFallido(email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.intentosFallidos.delete(email);

    const tokens = this.generateTokens(user.id, user.email, user.rol);
    return {
      ...tokens,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        areaId: user.areaId,
      },
    };
  }

  private registrarIntentoFallido(email: string) {
    const ahora = new Date();
    const actual = this.intentosFallidos.get(email) ?? { count: 0 };
    actual.count += 1;

    if (actual.count >= MAX_INTENTOS) {
      actual.bloqueadoHasta = new Date(ahora.getTime() + BLOQUEO_MS);
      actual.count = 0;
    }

    this.intentosFallidos.set(email, actual);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.meroUsuario.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException();
      }
      return this.generateTokens(user.id, user.email, user.rol);
    } catch {
      throw new UnauthorizedException('Token de refresco inválido');
    }
  }

  private generateTokens(userId: number, email: string, rol: string) {
    const payload = { sub: userId, email, rol };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });
    return { accessToken, refreshToken };
  }
}