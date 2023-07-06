import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { BuildingTypes } from 'src/BuildingTypes';
import { Building } from 'src/Models/Building';
import { MapService } from 'src/map/map.service';
import { Between, Repository } from 'typeorm';

@Injectable()
export class AutoTasksService {

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>,
        private readonly mapService: MapService
    ) { }


    @Cron(CronExpression.EVERY_5_MINUTES)
    async deleteOldUsers() {
        const bases = await this.mapRepo.find({
            where: {
                type: 'base'
            }
        })

        const date = Date.now()
        for (let l = 0; l < bases.length; l++) {
            if (bases[l].expiration > date) {
                this.mapRepo.delete(bases[l].id)
            }
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async deleteOldTaskSalvation() {
        const battles = await this.mapRepo.find({
            where: {
                type: BuildingTypes.MISSION_SLAWATION
            }
        })

        const date = Date.now()

        for (let l = 0; l < battles.length; l++) {
            if (battles[l].expiration > date && !battles[l].isBattle) {
                this.mapRepo.delete(battles[l].id)
            }
        }
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async spawnMine() {
        //получить список чанков
        //зайти в каждый чанк
        //заспавнить там по n шахт
        const chunks = this.mapService.getAllChunks()

        for (let l = 0; l < chunks.length; l++) {
            const startCoord = this.mapService.getChunkStartCoord(chunks[l])
            const endCoord = this.mapService.getChunkEndCoord(chunks[l])
            const mines = await this.mapRepo.find(
                {
                    where: {
                        type: BuildingTypes.MINE,
                        zone: 'testzone-',
                        x: Between(startCoord.x, endCoord.x),
                        y: Between(startCoord.y, endCoord.y)
                    }
                }
            )
            const spawnNum = 2 - mines.length

            if (spawnNum > 0) {
                for (let i = 0; i < spawnNum; i++) {
                    await this.mapService.createMine(chunks[l])
                }
            }
        }
    }

}
