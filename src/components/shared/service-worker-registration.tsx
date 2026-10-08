"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").then(async()=>{
        await navigator.serviceWorker.ready;
        if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));
        if(navigator.onLine){const results=await Promise.allSettled([import("@/components/progress/advanced-analytics"),import("@/components/shared/plate-calculator")]);if(results.every(result=>result.status==="fulfilled"))document.documentElement.dataset.offlineReady="true";}
      }).catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
    }
  }, []);
  useEffect(()=>{
    function navigateOffline(event:MouseEvent){
      if(navigator.onLine||!navigator.serviceWorker?.controller||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>("a[href]"):null;
      if(!anchor||anchor.download||anchor.target&&anchor.target!=="_self")return;
      const url=new URL(anchor.href,location.href);
      if(url.origin!==location.origin||url.pathname===location.pathname&&url.hash)return;
      event.preventDefault();location.assign(url.href);
    }
    document.addEventListener("click",navigateOffline);
    return()=>document.removeEventListener("click",navigateOffline);
  },[]);
  return null;
}
