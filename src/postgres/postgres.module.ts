import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from 'src/Models/Building';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'psqldb',
      port: 5432,
      username: 'keshox',
      password: 'example',
      database: 'mapdb',
      entities: [Building],
      synchronize: true,
      autoLoadEntities: true,
    }),
  ],
})
export class PostgresModule { }
