import type { AppProps } from "next/app";
import "../styles/globals.css";
// import type { AppProps } from 'next/app';
// import '../styles/globals.css';          // <= keep this
import GlowCursor from '../components/GlowCursor';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <GlowCursor />
      <Component {...pageProps} />
    </>
  );
}


// export default function App({ Component, pageProps }: AppProps) {
//   return <Component {...pageProps} />;
// }
