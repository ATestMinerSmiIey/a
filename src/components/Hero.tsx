import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import mascot from "@/assets/mascot.png";

const Hero = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center pt-16 border-b border-border/40">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.02] mb-6 tracking-tight flex items-center gap-3">
            <span>Hi</span>
            <img
              src={mascot}
              alt=""
              aria-hidden="true"
              className="inline-block w-14 h-14 md:w-20 md:h-20 object-contain select-none"
              style={{ imageRendering: "auto" }}
            />
            <span>Supply</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-10 leading-relaxed">
            Private marketplace. Crypto only.
          </p>

          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 group">
            <Link to="/shop">
              Enter
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;