import { Module, Global } from '@nestjs/common';
import { MapService } from './map.service';

@Global()
@Module({
    exports: [MapService],
    providers: [MapService]
})
export class MapModule { }
