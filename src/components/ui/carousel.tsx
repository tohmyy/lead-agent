"use client";

import * as React from "react";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];

type CarouselContextValue = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  selectedIndex: number;
  scrollPrev: () => void;
  scrollNext: () => void;
};

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }
  return context;
}

/** Subscribes to embla's own change events rather than mirroring them into
 * local state, so reading scroll position never needs a setState-in-effect. */
export function useEmblaSnapshot<T>(
  api: CarouselApi,
  getSnapshot: (api: NonNullable<CarouselApi>) => T,
  fallback: T,
): T {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      if (!api) return () => {};
      api.on("select", callback);
      api.on("reInit", callback);
      return () => {
        api.off("select", callback);
        api.off("reInit", callback);
      };
    },
    [api],
  );
  const getSnap = React.useCallback(
    () => (api ? getSnapshot(api) : fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSnapshot/fallback are stable per call site
    [api],
  );
  return React.useSyncExternalStore(subscribe, getSnap, getSnap);
}

function Carousel({
  opts,
  setApi,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  opts?: CarouselOptions;
  setApi?: (api: CarouselApi) => void;
}) {
  const [carouselRef, api] = useEmblaCarousel(opts);
  const canScrollPrev = useEmblaSnapshot(api, (a) => a.canScrollPrev(), false);
  const canScrollNext = useEmblaSnapshot(api, (a) => a.canScrollNext(), false);
  const selectedIndex = useEmblaSnapshot(api, (a) => a.selectedScrollSnap(), 0);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  React.useEffect(() => {
    if (api) setApi?.(api);
  }, [api, setApi]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        canScrollPrev,
        canScrollNext,
        selectedIndex,
        scrollPrev,
        scrollNext,
      }}
    >
      <div
        data-slot="carousel"
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef } = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        data-slot="carousel-content"
        className={cn("flex", className)}
        {...props}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="carousel-item"
      role="group"
      aria-roledescription="slide"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  );
}

function CarouselPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      data-slot="carousel-previous"
      variant="outline"
      size="icon-sm"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous company"
      className={className}
      {...props}
    >
      <ArrowLeftIcon />
    </Button>
  );
}

function CarouselNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      data-slot="carousel-next"
      variant="outline"
      size="icon-sm"
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next company"
      className={className}
      {...props}
    >
      <ArrowRightIcon />
    </Button>
  );
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
};
