'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

export const EASE = [0.16, 1, 0.3, 1];

/** Angka yang "menghitung naik" dengan halus ketika nilainya berubah. */
export function useAnimatedNumber(value, duration = 0.9) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    const controls = animate(from.current, Number(value) || 0, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    from.current = Number(value) || 0;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return display;
}

export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('id-ID'), duration }) {
  const v = useAnimatedNumber(value, duration);
  return <>{format(v)}</>;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

/** Wadah yang memunculkan anak-anaknya satu per satu (stagger). */
export function Stagger({ as = 'div', className, children, ...rest }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={container} initial="hidden" animate="show" {...rest}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ as = 'div', className, children, ...rest }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={item} {...rest}>
      {children}
    </Comp>
  );
}

/** Baris tabel yang muncul halus (delay bertahap, dibatasi agar tabel panjang tetap cepat). */
export function MotionRow({ index = 0, children, ...rest }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 14) * 0.022 }}
      {...rest}
    >
      {children}
    </motion.tr>
  );
}
