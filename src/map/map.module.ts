import { Module, Global } from '@nestjs/common';
import { MapService } from './map.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from 'src/Models/Building';

@Global()
@Module({
    exports: [MapService],
    providers: [MapService],
    imports: [TypeOrmModule.forFeature([Building])]
})
export class MapModule { }
