import { Geist_Mono } from 'next/font/google';

import styles from './Own3dScreen.module.css';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
});

const RAIN_STREAMS = [
  '01100110100110100101101001011010010110100110100101101001',
  '10010110100101101001011001101001011010010110100101100110',
  '00101101001101001011010010110100101100110100101101001011',
  '11010010110100101101001011001101001011010010110100101100',
  '01011010010110100101100110100101101001011010010110011010',
  '10110100101101001011010010110011010010110100101101001011',
  '00110100101101001011010010110100101100110100101101001011',
  '11001011010010110100101101001011001101001011010010110100',
] as const;

export function Own3dScreen() {
  return (
    <main
      className={`${geistMono.className} ${styles.screen}`}
      aria-labelledby="own3d-screen-title"
      data-own3d-screen
    >
      <div className={styles.rain} aria-hidden="true">
        {RAIN_STREAMS.map((stream, index) => (
          <span key={`${index}-${stream.slice(0, 8)}`}>{stream}</span>
        ))}
      </div>

      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.flicker} aria-hidden="true" />

      <div className={styles.message}>
        <h1
          id="own3d-screen-title"
          className={styles.title}
          aria-label="own3d by tub1cs"
          data-text="own3d by tub1cs"
        >
          own3d by tub1cs
        </h1>
      </div>
    </main>
  );
}
