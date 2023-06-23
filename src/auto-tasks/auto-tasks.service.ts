import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from 'src/Models/Building';
import { Repository } from 'typeorm';

@Injectable()
export class AutoTasksService {

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
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



    // @Cron(CronExpression.EVERY_5_MINUTES)
    // async deleteOldTaskPersonal() {
    //     const battles = await this.mapRepo.find({
    //         where: {
    //             type: 'taskPersonal'
    //         }
    //     })

    //     const date = Date.now()
    //     for (let l = 0; l < battles.length; l++) {
    //         if (battles[l].expiration > date) {
    //             this.mapRepo.delete(battles[l].id)
    //         }
    //     }

    // }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async deleteOldTaskSalvation() {
        const battles = await this.mapRepo.find({
            where: {
                type: 'taskSalvation'
            }
        })

        const date = Date.now()

        for (let l = 0; l < battles.length; l++) {
            if (battles[l].expiration > date && !battles[l].isBattle) {
                this.mapRepo.delete(battles[l].id)
            }
        }
    }
}
