import * as bcrypt from 'bcryptjs';
import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

/**
 * Represents a local server in the system.
 */
@Entity({ name: 'admins' })
export class RemoteAdmin {
    @PrimaryColumn({ name: 'email', type: 'varchar', length: 100, nullable: false })
    public email: string;

    /** Display name */
    @Column({ name: 'display_name', type: 'varchar', length: 30, nullable: true })
    public displayName: string;

    @Column({ name: 'password', type: 'varchar', length: 256, nullable: false, select: false })
    public password: string;

    @Column({ name: 'ignore_tfa', type: 'boolean', nullable: false })
    public ignoreTfa: boolean;

    @BeforeInsert()
    beforeInsert() {
        this.password = bcrypt.hashSync(this.password, 12);
    }
}