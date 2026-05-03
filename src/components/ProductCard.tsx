import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { Product } from "@/data/products";

const ProductCard = ({ product, index = 0 }: { product: Product; index?: number }) => {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group glass-card rounded-2xl overflow-hidden block opacity-0 animate-fade-in-up hover:border-primary/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-glow-cyan"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="aspect-square overflow-hidden relative bg-muted">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />
      </div>
      <div className="p-5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-base truncate group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Package className="h-3 w-3 text-primary" />
            {product.stock}
          </div>
        </div>
        <div className="flex items-end justify-between pt-2">
          <div>
            <div className="font-display text-xl font-bold text-gradient">${Number(product.price).toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{product.stock} in stock</div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-primary/70 font-medium">View →</span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
