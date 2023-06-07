import { Inject, Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Bullding';
import { Repository } from 'typeorm';
import { LoggerService } from './logger/logger.service';
import { RabbitMQService } from './rabbit/rabbit.servicve';


@Injectable()
export class AppService {

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
    ) { }

    @Inject(LoggerService)
    private readonly loggerService: LoggerService

    @Inject(RabbitMQService)
    private readonly rabbitService: RabbitMQService

    // async dataSaveResponser(data: any) {
    //     const responseDTO = new ResponseDTO()
    //     let status = 200

    //     try {
    //         const resonseDataDTO = await this.dataSaveHandler(data)
    //         responseDTO.data = resonseDataDTO
    //     }
    //     catch (e) {
    //         if (e == 'sessions not found' || e == 'session expired') {
    //             status = 403//перезапуск клиента
    //         }
    //         else if (e == 'too many requests') {
    //             status = 429//повторить запрос позже
    //         } else if (e == 'parsing data error') {
    //             status = 400 //сервер не знает что делать
    //         } else {
    //             status = 400
    //         }
    //         console.log("Ошибка " + e)
    //     }
    //     responseDTO.status = status

    //     return responseDTO
    // }

    // async dataSaveHandler(data: any): Promise<ResonseDataDTO> {
    //     let dataDTO
    //     try {
    //         dataDTO = new DataDTO(data.accountId, data.sessionId, data.dataObjects)
    //     } catch (e) {
    //         throw "parsing data error"
    //     }

    //     return this.dataSaveLogic(dataDTO)
    // }


    // async dataSaveLogic(dataDTO: DataDTO): Promise<ResonseDataDTO> {
    //     const accountId = dataDTO.accountId
    //     const incomingObjects = this.parseDataObjectsPOST(dataDTO.dataObjects)

    //     const savedObjects = await this.findAllDataObjectsByAccountId(accountId)

    //     for (let l = 0; l < incomingObjects.length; l++) {
    //         try {
    //             const obj = this.getObjectByKey(incomingObjects[l].key, savedObjects)
    //             await this.updateObjectsValueByAccountIdAndKey(obj, incomingObjects[l].value)
    //             console.log("Обновлен обьект: " + incomingObjects[l].key)
    //         } catch (e) {
    //             if (e == 'object not found') {
    //                 await this.saveObject(accountId, incomingObjects[l].key, incomingObjects[l].value)
    //                 console.log("Сохранен новый обьект: " + incomingObjects[l].key)
    //                 continue
    //             }
    //             console.log("Хз чего произошло")
    //             throw e
    //         }
    //     }
    //     return new ResonseDataDTO()
    // }

    //----------------------------------------

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
            dataDTO = new DataDTO(data.accountId, data.coordinaes)
        } catch (e) {
            throw "parsing data error"
        }

        return await this.mapGetLogic(dataDTO)
    }

    async mapGetLogic(dataDTO: DataDTO): Promise<Building[]> {
        //размер карты 512 х 512 = 262144
        //размер чанка 64 х 64 = 4096
        //координаты чанков 0:0 7:7
        //координаты клеток 0:0 63:63

        const coordinates = dataDTO.coordinates

        console.log('1')
        console.log(coordinates)
        const zoneId = this.parseZone(coordinates)
        console.log('2')
        let chunk = this.parseCoordinates(coordinates)
        console.log('3')

        if (chunk == 'none') {
            console.log('создана новая база')
            const building = await this.createNewBase(dataDTO.accountId, zoneId)
            chunk = building.chunk
            this.rabbitService.questionerUser({ accountId: dataDTO.accountId, coordinates: zoneId + ':' + chunk }, 'change_chunk')
        }
        if (chunk == undefined || chunk == "undefined") { console.log('Пришла пустота') }

        return await this.findChunkByZoneIdAndChunc(zoneId, chunk)
    }

    //----------------------------------------------------------

    async findBaseByAccountIdAndZoneId(accountId: string, zoneId: string) {
        const base = await this.mapRepo.find({
            where: {
                accountId: accountId,
                zoneId: zoneId
            }
        })
        return base
    }

    async findChunkByZoneIdAndChunc(zoneId: string, chunk: string): Promise<Building[]> {
        const base = await this.mapRepo.find({
            where: {
                chunk: chunk,
                zoneId: zoneId
            }
        })
        return base
    }

    async createNewBase(accountId: string, zoneId: string): Promise<Building> {
        const chunk = this.generateRandomChunk()
        const coords = this.generateRandomCoordInChunk()
        return await this.mapRepo.save(
            await this.mapRepo.create(
                {
                    accountId: accountId,
                    zoneId: zoneId,
                    type: 'base',
                    coords: coords,
                    chunk: chunk
                }
            )
        )
    }

    // async saveBuilding(building: Building): Promise<Building> {
    //     return await this.mapRepo.save(building)
    // }

    convertArrayCoordsToString(arr: Array<number>): string {
        return arr[0] + ',' + arr[1]
    }

    // convertStringToCoordsArray(str: string): Array<number> {
    //     const strArr = str.split(',', 2)
    //     return [parseInt(strArr[0]), parseInt(strArr[1])]
    // }

    findFreeCoords(arr: Array<Building>): string {
        const coords = this.generateRandomCoordInChunk()

        for (let l = 0; l < arr.length; l++) {
            if (arr[l].coords == coords) {
                return this.findFreeCoords(arr)
            } else {
                return coords
            }
        }
        return 'Такого быть не должно, ide ругается'
    }

    generateRandomCoordInChunk(): string {
        const coords = [Math.floor(Math.random() * 63), Math.floor(Math.random() * 63)]
        return this.convertArrayCoordsToString(coords)
    }

    generateRandomChunk(): string {
        const coords = [Math.floor(Math.random() * 7), Math.floor(Math.random() * 7)]
        return this.convertArrayCoordsToString(coords)
    }

    parseZone(str: string): string {
        return str.split(':')[0]
    }

    parseCoordinates(str: string): string {
        return str.split(':')[1]
    }
}


