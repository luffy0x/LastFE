import type { Metadata } from "next";

import { SiteFooter } from "@/features/shell/components/SiteFooter";
import { SiteHeader } from "@/features/shell/components/SiteHeader";
import { ThemeProvider } from "@/features/shell/components/ThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "LastFE",
  description: "公开、免注册的求职知识库：面经、学习资料、八股、项目与算法。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <a className="skip-link" href="#main-content">
            跳到主要内容
          </a>
          <div className="site-shell">
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
