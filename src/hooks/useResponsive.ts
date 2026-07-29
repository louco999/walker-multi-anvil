import { useEffect } from 'react';
import { useWalkerStore } from '../store/useWalkerStore';

export function useResponsive(): void {
  const setIsMobile = useWalkerStore((s) => s.setIsMobile);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const apply = () => setIsMobile(mq.matches || window.innerWidth < 768);
    apply();
    mq.addEventListener('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, [setIsMobile]);
}
