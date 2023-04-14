import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true, // Cargar las entidades automaticante
      synchronize: true, // Solo se recomienda en desarrollo, en producción deberia estar en false, SIRVE: sincronizar los cambios de las entidades con las tablas
    }),
    ProductsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
