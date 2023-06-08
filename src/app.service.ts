import { Inject, Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Building';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { LoggerService } from './logger/logger.service';
import { RabbitMQService } from './rabbit/rabbit.servicve';


@Injectable()
export class AppService {

    private mapSizeCells = 512
    private mapSizeChunks = 8

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
    ) { }

    @Inject(LoggerService)
    private readonly loggerService: LoggerService

    @Inject(RabbitMQService)
    private readonly rabbitService: RabbitMQService

    async mapGetResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const response = await this.mapGetHandler(data)
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

    async mapGetHandler(data: any): Promise<Building[]> {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y)
        } catch (e) {
            throw "parsing data error"
        }

        return await this.mapGetLogic(dataDTO)
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

        const zone = dataDTO.zone
        const coords = new Vector2(dataDTO.x, dataDTO.y)

        return await this.findObjects(coords, zone)
    }

    async findObjects(vector: Vector2, zone: string): Promise<Building[]> {
        //запросить весь чанк из бд
        //получить координату начала и конца чанка по двум осям

        const xStart = this.getChunkStartCoord(vector.x)
        const yStart = this.getChunkStartCoord(vector.y)

        const xEnd = this.getChunkEndCoord(vector.x)
        const yEnd = this.getChunkEndCoord(vector.y)

        const buildings = await this.mapRepo.find({
            where: {
                zone: zone,
                x: Between(xStart, xEnd),
                y: Between(yStart, yEnd)
            }
        })
        return buildings
    }

    private getChunkStartCoord(coord: number): number {
        return this.getChunkSize() * coord
    }

    private getChunkEndCoord(coord: number): number {
        return this.getChunkSize() * (coord + 1) - 1
    }

    private getChunkSize(): number {
        return this.mapSizeCells / this.mapSizeChunks
    }

    private getChunk(vector: Vector2): Vector2 {
        const xChunk = (vector.x - vector.x % this.mapSizeChunks) / this.mapSizeChunks
        const yChunk = (vector.y - vector.y % this.mapSizeChunks) / this.mapSizeChunks

        return new Vector2(xChunk, yChunk)
    }

    async coordBaseGetResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const response = await this.coordBaseGetHandler(data)
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

    async coordBaseGetHandler(data: any): Promise<object> {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y)
        } catch (e) {
            throw "parsing data error"
        }

        return await this.coordBaseGetLogic(dataDTO)
    }

    async coordBaseGetLogic(dataDTO: DataDTO): Promise<object> {
        /**
         * ищем аккаунт по айди
         * если не находим создаем базу в рандомных координатах
         * если находим отправляем координаты
         */
        let building: Building
        try {
            building = await this.getBaceByAccountid(dataDTO.accountId)
        }
        catch (e) {
            console.log('ошибка:    ' + e)
            building = await this.createBace(dataDTO.accountId, dataDTO.zone)
        }

        return { x: building.x, y: building.y }
    }

    async getBaceByAccountid(accountId: string): Promise<Building> {
        const buildings = await this.mapRepo.find({
            where: {
                accountId: accountId
            }
        })
        return buildings[0]
    }

    async createBace(accountId: string, zone: string) {
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    accountId: accountId,
                    zone: zone,
                    type: 'base',
                    x: 1,
                    y: 1,
                }
            )
        )
    }
}

class Vector2 {
    x: number
    y: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }
}

