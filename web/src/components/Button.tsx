import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "quiet";
type ButtonSize = "regular" | "large";

type CommonProps = {
  /** primary=主操作，secondary=并列次级操作，quiet=低干扰文字跳转 */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 是否显示右侧箭头；primary/secondary 默认显示，quiet 默认隐藏 */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonElementProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  keyof CommonProps
>;

type AnchorElementProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  keyof CommonProps | "href"
>;

export type ButtonProps =
  | (CommonProps & ButtonElementProps & { href?: undefined })
  | (CommonProps & AnchorElementProps & { href: string });

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "regular",
    arrow,
    className,
    children,
    href,
    ...rest
  } = props;

  const classNames = [
    "app-button",
    `app-button--${variant}`,
    `app-button--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const showArrow = arrow ?? variant !== "quiet";

  const content = (
    <>
      <span>{children}</span>
      {showArrow ? (
        <span className="app-button__arrow" aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        className={classNames}
        href={href}
        {...(rest as AnchorElementProps)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button className={classNames} {...(rest as ButtonElementProps)}>
      {content}
    </button>
  );
}
