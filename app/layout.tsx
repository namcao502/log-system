import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TSC Daily Log",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('tsc-theme-rainbow')==='1'){var h=parseFloat(localStorage.getItem('tsc-theme-hue')||'0');document.documentElement.style.setProperty('--theme-hue',h);}else{var c=localStorage.getItem('tsc-theme-color');if(c){var r=parseInt(c.slice(1,3),16)/255,g=parseInt(c.slice(3,5),16)/255,b=parseInt(c.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d!==0){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=Math.round(h*60+(h<0?360:0));}document.documentElement.style.setProperty('--theme-hue',h);}}}catch(e){}` }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
