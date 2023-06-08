import { Inject, Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Building';
import { Between, Repository } from 'typeorm';
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
        console.log(JSON.stringify(data))
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y)) {
                throw 'Пришли пустые данные'
            }
        } catch (e) {
            throw "parsing data error"
        }

        return await this.mapGetLogic(dataDTO)
    }

    async mapGetLogic(dataDTO: DataDTO): Promise<Building[]> {
        console.log(dataDTO)
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
            console.log('1w')
            base = await this.getBase(dataDTO)
            console.log('133')
            coords = new Vector2(base.x, base.y)
            console.log('13223')
        }
        else {
            console.log('1ddds')
            coords = new Vector2(dataDTO.x, dataDTO.y)
            console.log('1dw')
        }
        console.log('1')
        return await this.findObjects(coords, zone)
    }

    async getBase(dataDTO: DataDTO): Promise<Building> {
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

        return building
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

    async getBaceByAccountid(accountId: string): Promise<Building> {
        const buildings = await this.mapRepo.find({
            where: {
                accountId: accountId
            }
        })
        return buildings[0]
    }

    async createBace(accountId: string, zone: string) {
        const freeCoordinates = await this.generateFreeCoordinates()
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    accountId: accountId,
                    zone: zone,
                    type: 'base',
                    x: freeCoordinates.x,
                    y: freeCoordinates.y
                }
            )
        )
    }

    private generateRandomCoordinate() {
        return Math.floor(Math.random() * this.mapSizeCells)
    }

    private async generateFreeCoordinates(): Promise<Vector2> {
        const x = this.generateRandomCoordinate()
        const y = this.generateRandomCoordinate()
        if (await this.isCoordinatesFree(x, y)) {
            return new Vector2(x, y)
        }
        else {
            return await this.generateFreeCoordinates()
        }
    }

    private async isCoordinatesFree(x: number, y: number): Promise<boolean> {
        const result = await this.mapRepo.find({
            where: {
                x: x,
                y: y
            }
        })
        if (result[0]) {
            console.log('---' + result[0])
            return false
        } else {
            return true
        }
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

