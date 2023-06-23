import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern } from '@nestjs/microservices';
import { ResponseDTO } from './DTO/ResponseDTO';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @EventPattern('get_map')
    async getMap(data: any): Promise<ResponseDTO> {
        return await this.appService.mapGetResponser(data)
    }

    @EventPattern('get_enemy')
    async getEnemy(data: any): Promise<ResponseDTO> {
        return await this.appService.getEnemyResponser(data)
    }

    @EventPattern('attack_enemy')
    async attackEnemy(data: any): Promise<ResponseDTO> {
        return await this.appService.attackEnemyResponser(data)
    }
}
