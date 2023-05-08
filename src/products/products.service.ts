import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { validate as isUUID } from 'uuid';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { ProductImage } from './entities';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;
      // crear instancia del producto con sus propiedades
      const product = this.productRepository.create({
        ...productDetails,
        // infiere que el id del producto, es el id que tiene las imagenes como referencia
        images: images.map(url => this.productImageRepository.create({ url })),
      });

      await this.productRepository.save(product);

      return { ...product, images };
    } catch (error) {
      this.handleDDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const [records = [], total = 0] = await this.productRepository.findAndCount(
      {
        take: paginationDto.limit,
        skip: paginationDto.offset,
        relations: { images: true },
      },
    );
    return {
      total,
      records: records.map(product => ({
        ...product,
        images: product.images.map(img => img.url),
      })),
    };
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term))
      product = await this.productRepository.findOneBy({ id: term });
    else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: term.toUpperCase(),
          slug: term.toLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product) throw new NotFoundException(`Product with ${term} not found`);

    return product;
  }

  async findOnePlain(term: string) {
    const { images, ...rest } = await this.findOne(term);
    return {
      ...rest,
      images: images.map(image => image.url),
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    // queryRunner allows us execute x query amount, if every query is correct, so the query run on data base, if they are incorrect, so revert them

    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({
      id,
      ...toUpdate,
    });

    if (!product) throw new NotFoundException(`Product not found`);

    // Create QueryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });

        product.images = images.map(image =>
          this.productImageRepository.create({ url: image }),
        );
      }
      await queryRunner.manager.save(product);

      //await this.productRepository.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDDBExceptions(error);
    }
  }

  async remove(id: string) {
    await this.productRepository.delete({ id });
    return `This action removes a #${id} product`;
  }

  private handleDDBExceptions(error: any) {
    //console.log(error);
    if (error.code === '23505') throw new BadRequestException(error.detail);
    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, check logs');
  }
}
