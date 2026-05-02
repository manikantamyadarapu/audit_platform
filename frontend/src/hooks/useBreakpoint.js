import { useEffect, useState } from 'react';

/**
 * @param {number} px
 */
export function useBreakpoint(px = 1024) {
  const [ok, setOk] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= px : false
  );

  useEffect(() => {
    const onResize = () => setOk(window.innerWidth >= px);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [px]);

  return ok;
}
