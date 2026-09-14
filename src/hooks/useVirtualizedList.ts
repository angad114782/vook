import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

type VirtualItem<T> = { item: T; key: string; index: number; top: number };

function findFirstVisible(offsets: number[], sizes: number[], target: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle]! + sizes[middle]! <= target) low = middle + 1;
    else high = middle - 1;
  }
  return Math.min(low, Math.max(0, offsets.length - 1));
}

/**
 * Lightweight variable-height windowing with measured rows. It keeps the DOM
 * bounded without adding a second virtualization dependency to the bundle.
 */
export function useVirtualizedList<T>(
  items: readonly T[],
  containerRef: RefObject<HTMLElement | null>,
  getKey: (item: T) => string,
  estimateSize = 72,
  overscan = 6,
) {
  const sizeByKey = useRef(new Map<string, number>());
  const elementByKey = useRef(new Map<string, HTMLElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<Map<string, number>>(() => new Map());
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key = entry.target.getAttribute('data-virtual-key');
        if (!key) continue;
        const height = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
        if (height > 0 && sizeByKey.current.get(key) !== height) {
          sizeByKey.current.set(key, height);
          changed = true;
        }
      }
      if (changed) setMeasuredSizes(new Map(sizeByKey.current));
    });
    return () => observer.current?.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateViewport = () => setViewport({ scrollTop: element.scrollTop, height: element.clientHeight });
    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  const layout = useMemo(() => {
    const offsets: number[] = [];
    const sizes: number[] = [];
    let totalSize = 0;
    for (const item of items) {
      const size = measuredSizes.get(getKey(item)) ?? estimateSize;
      offsets.push(totalSize);
      sizes.push(size);
      totalSize += size;
    }
    return { offsets, sizes, totalSize };
  }, [items, getKey, estimateSize, measuredSizes]);

  const virtualItems = useMemo<VirtualItem<T>[]>(() => {
    if (!items.length) return [];
    const start = Math.max(0, findFirstVisible(layout.offsets, layout.sizes, viewport.scrollTop) - overscan);
    const end = Math.min(
      items.length,
      findFirstVisible(layout.offsets, layout.sizes, viewport.scrollTop + viewport.height) + overscan + 1,
    );
    return items.slice(start, end).map((item, relativeIndex) => {
      const index = start + relativeIndex;
      return { item, key: getKey(item), index, top: layout.offsets[index]! };
    });
  }, [items, getKey, layout, overscan, viewport]);
  const firstVisibleIndex = useMemo(
    () => items.length ? findFirstVisible(layout.offsets, layout.sizes, viewport.scrollTop) : 0,
    [items.length, layout, viewport.scrollTop],
  );

  const onScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    setViewport((current) => (
      current.scrollTop === element.scrollTop && current.height === element.clientHeight
        ? current
        : { scrollTop: element.scrollTop, height: element.clientHeight }
    ));
  }, []);
  const getOffset = useCallback((index: number) => layout.offsets[index] ?? 0, [layout.offsets]);

  const measureRef = useCallback((key: string, element: HTMLElement | null) => {
    const previous = elementByKey.current.get(key);
    if (previous && previous !== element) observer.current?.unobserve(previous);
    if (!element) {
      elementByKey.current.delete(key);
      return;
    }
    elementByKey.current.set(key, element);
    element.setAttribute('data-virtual-key', key);
    observer.current?.observe(element);
    const height = Math.ceil(element.getBoundingClientRect().height);
    if (height > 0 && sizeByKey.current.get(key) !== height) {
      sizeByKey.current.set(key, height);
      setMeasuredSizes(new Map(sizeByKey.current));
    }
  }, []);

  return {
    virtualItems,
    totalSize: layout.totalSize,
    firstVisibleIndex,
    scrollTop: viewport.scrollTop,
    getOffset,
    onScroll,
    measureRef,
  };
}
