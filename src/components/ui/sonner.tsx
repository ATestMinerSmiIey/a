import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster"
      {...props}
    />
  );
};

export { Toaster, toast };