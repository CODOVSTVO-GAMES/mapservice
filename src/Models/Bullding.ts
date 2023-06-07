import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Building {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column()
    zoneId: string

    @Column()
    chunk: string

    @Column()
    coords: string

    @Column()
    type: string

    @Column()
    accountId: string
}