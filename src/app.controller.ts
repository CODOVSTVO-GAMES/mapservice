import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern } from '@nestjs/microservices';
import { ResponseDTO } from './DTO/ResponseDTO';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    // @EventPattern('save_data')
    // async saveData(data: any): Promise<ResponseDTO> {
    //     return await this.appService.dataSaveResponser(data)
    // }

    @EventPattern('get_map')
    async getMap(data: any): Promise<ResponseDTO> {
        return await this.appService.mapGetResponser(data)
    }

    @EventPattern('get_my_coords')
    async getCoords(data: any): Promise<ResponseDTO> {
        return await this.appService.coordBaseGetResponser(data)
    }
}
