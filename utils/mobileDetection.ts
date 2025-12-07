export const isMobileWebView = (): boolean => {
  // Check if running in a mobile WebView (common in wrapped apps)
  const userAgent = navigator.userAgent.toLowerCase();

  // Check for common WebView indicators
  const isWebView = /wv|webview|android.*version\/\d+\.\d+|mobile.*safari/i.test(userAgent);

  // Check for mobile devices
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // Additional checks for wrapped apps
  const isWrappedApp = window.innerWidth === window.screen.width &&
                      window.innerHeight === window.screen.height;

  return (isWebView && isMobile) || isWrappedApp;
};

export const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};
