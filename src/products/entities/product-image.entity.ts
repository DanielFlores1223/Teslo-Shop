import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  url: string;

  //reference and create the column id
  @ManyToOne(() => Product, product => product.images)
  //@JoinColumn({ name: 'product_id' }) change column name
  product: Product;
}
