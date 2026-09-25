import { Loader2Icon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const spinnerVariants = cva("animate-spin motion-reduce:animate-none", {
  variants: {
    size: {
      xs: "size-3",
      sm: "size-3.5",
      default: "size-4",
      lg: "size-5",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<typeof Loader2Icon> &
  VariantProps<typeof spinnerVariants>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden
      className={cn(spinnerVariants({ size, className }))}
      {...props}
    />
  );
}

export { Spinner, spinnerVariants };
