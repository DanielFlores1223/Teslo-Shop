import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      const queryBuilder = this.productRepository.createQueryBuilder();
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: term.toUpperCase(),
          slug: term.toLowerCase(),
        })
        .getOne();
    }

    if (!product) throw new NotFoundException(`Product with ${term} not found`);

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.preload({
      id,
      ...updateProductDto,
      images: [],
    });

    if (!product) throw new NotFoundException(`Product not found`);

    try {
      await this.productRepository.save(product);

      return product;
    } catch (error) {
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
