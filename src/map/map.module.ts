import { Module, Global } from '@nestjs/common';
import { MapService } from './map.service';

@Global()
@Module({
    exports: [MapService]
})
export class MapModule { }
