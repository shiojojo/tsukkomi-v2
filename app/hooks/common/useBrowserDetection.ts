import { useState, useEffect } from 'react';

/**
 * カスタムフック: モバイルブラウザのスクロール動作を検出
 * Chrome on Android または iOS Safari/CriOS でドキュメントスクロールを使用するかどうかを判定
 * @returns useDocumentScroll ドキュメントスクロールを使用するかどうか
 */
export function useBrowserDetection() {
  const [useDocumentScroll, setUseDocumentScroll] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    try {
      const ua = navigator.userAgent ?? '';
      const isAndroid = /Android/i.test(ua);
      const isChrome = /Chrome\//i.test(ua);
      const isEdge = /Edg\//i.test(ua);
      const isOpera = /OPR\//i.test(ua);
      const isSamsung = /SamsungBrowser/i.test(ua);

      const maxTouchPoints =
        typeof navigator.maxTouchPoints === 'number'
          ? navigator.maxTouchPoints
          : 0;
      const isiOSFamily =
        /iP(hone|od|ad)/i.test(ua) ||
        (ua.includes('Macintosh') && maxTouchPoints > 1);
      const isCriOS = /CriOS/i.test(ua);
      const isMobileSafari =
        isiOSFamily && /Version\/\d+.*Safari/i.test(ua) && !isCriOS;

      if (
        (isAndroid && isChrome && !isEdge && !isOpera && !isSamsung) ||
        (isiOSFamily && (isCriOS || isMobileSafari))
      ) {
        setUseDocumentScroll(true);
      }
    } catch {}
  }, []);

  return useDocumentScroll;
}