import { Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Building';
import { Repository } from 'typeorm';
import { LoggerService } from './logger/logger.service';
import { RabbitMQService } from './rabbit/rabbit.servicve';
import { BuildingTypes } from './BuildingTypes';
import { MapService } from './map/map.service';
import { Vector2 } from './map/map.service';


@Injectable()
export class AppService {

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>,
        private readonly loggerService: LoggerService,
        private readonly rabbitService: RabbitMQService,
        private readonly mapService: MapService
    ) { }

    async mapGetResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumberr, data.battleOwner, data.taskId)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y)) {
                throw 'Пришли пустые данные'
            }

            responseDTO.data = await this.mapGetLogic(dataDTO)
        }
        catch (e) {
            if (e == 'sessions not found' || e == 'session expired') {
                status = 403//перезапуск клиента
            }
            else if (e == 'too many requests') {
                status = 429//повторить запрос позже
            } else if (e == 'parsing data error') {
                status = 400 //сервер не знает что делать
            } else {
                status = 400
            }
            console.log("Ошибка " + e)
        }
        responseDTO.status = status
        return responseDTO
    }


    async mapGetLogic(dataDTO: DataDTO): Promise<Building[]> {
        /**
         * у игрока есть адрес базы и айди зоны
         * В базе данных лежат обьекты карты
         * в редисе хранятся чанки карты
         * В редис данные загружаются раз в минуту автоматически либо при совершении критического действия
         * мы доверяем редису что у него последние данные
         * игрок запрашивает карту, мы выдаем ему ближайшие к его координате чанки
         */
        let base: Building

        const zone = dataDTO.zone
        let coords: Vector2

        if (dataDTO.x == 0 && dataDTO.y == 0) {
            base = await this.mapService.getBase(dataDTO)
            coords = new Vector2(base.x, base.y)
        }
        else {
            coords = new Vector2(dataDTO.x, dataDTO.y)
        }
        return await this.mapService.findObjects(coords, zone)
    }

    //-----------------------------------------------------------------------

    async getEnemyResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber, data.battleOwner, data.taskId)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y) || dataDTO.level == undefined) {
                throw 'Пришли пустые данные'
            }

            const response = await this.getEnemyResponserLogic(dataDTO)
            responseDTO.data = response
        }
        catch (e) {
            if (e == 'sessions not found' || e == 'session expired') {
                status = 403//перезапуск клиента
            }
            else if (e == 'too many requests') {
                status = 429//повторить запрос позже
            } else if (e == 'parsing data error') {
                status = 400 //сервер не знает что делать
            } else {
                status = 400
            }
            console.log("Ошибка " + e)
        }
        responseDTO.status = status
        return responseDTO
    }


    async getEnemyResponserLogic(dataDTO: DataDTO): Promise<Building[]> {
        /**
         * у игрока есть адрес базы и айди зоны
         * В базе данных лежат обьекты карты
         * 
         * запрашиваем обьекты вокруг игрока
         * проверяем сколько вокруг противников нужного уровня с овнером игроком
         * если больше чем надо просто возвращаем структуру
         * если меньше то доспавниваем нужное число
         */

        console.log('----')
        console.log(dataDTO)

        const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
        const buildings = await this.mapService.findObjects(baseCoords, dataDTO.zone)

        let battleFits = 0

        for (let l = 0; l < buildings.length; l++) {
            if ((buildings[l].type == BuildingTypes.MISSION_SLAWATION) && buildings[l].owner == dataDTO.accountId) {
                battleFits += 1
                if (battleFits >= dataDTO.battlesNumber) {
                    return buildings
                }
            }
        }

        const createBattlesNumber = dataDTO.battlesNumber - battleFits

        for (let l = 0; l < createBattlesNumber; l++) {
            const enemy = await this.mapService.createNewEnemy(dataDTO)
            buildings.push(enemy)
        }
        return buildings
    }

    //--------------------


    async attackEnemyResponser(data: any): Promise<ResponseDTO> {
        console.log(data)
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber, data.battleOwner, data.taskId, data.taskStatus)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y)) {
                throw 'Пришли пустые данные'
            }

            responseDTO.data = await this.attackEnemyLogic(dataDTO)
        }
        catch (e) {
            if (e == 'sessions not found' || e == 'session expired') {
                status = 403//перезапуск клиента
            }
            else if (e == 'too many requests') {
                status = 429//повторить запрос позже
            } else if (e == 'parsing data error') {
                status = 400 //сервер не знает что делать
            } else {
                status = 400
            }
            console.log("Ошибка " + e)
        }
        responseDTO.status = status
        return responseDTO
    }

    async attackEnemyLogic(dataDTO: DataDTO): Promise<Building[]> {
        //сообщение об атаке врага. Начало, победа, поражение

        const task = await this.getEnemyById(dataDTO.taskId)

        //если статус начало
        //находим обьект по айди
        //ставим статус активен

        if (dataDTO.taskStatus == 1) {
            task.isBattle = true
            this.mapRepo.save(task)
        }
        else if (dataDTO.taskStatus == 2) {
        }


        //если статус победа
        //удаляем обьект 
        else if (dataDTO.taskStatus == 3) {
            this.mapRepo.delete(dataDTO.taskId)
        }

        //если статус поражение
        //ставим статус не активен
        else {
            task.isBattle = false
            this.mapRepo.save(task)
        }

        return []
    }

    async getEnemyById(id: number): Promise<Building> {
        const buildings = await this.mapRepo.find({
            where: {
                id: id
            }
        })
        if (buildings.length == 0) throw 'Базы не существует'
        return buildings[0]
    }
}

// class Vector2 {
//     x: number
//     y: number
//     constructor(x: number, y: number) {
//         this.x = x
//         this.y = y
//     }
// }

