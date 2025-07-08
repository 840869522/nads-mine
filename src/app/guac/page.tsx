'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, Suspense } from 'react'
import Guacamole from 'guacamole-common-js'

export const dynamic = 'force-dynamic'

function GuacInner() {
  const params = useSearchParams();
  const type = params.get('type') || '';
  const hostname = params.get('hostname') || '';
  const port = params.get('port') || '';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !type || !hostname || !port) return;
    let client: Guacamole.Client | null = null;
    let ignore = false;
    const params = new URLSearchParams({ type, hostname, port }).toString();
    fetch('/api/guac-token?' + params)
      .then(r => r.json())
      .then(data => {
        if (ignore || !ref.current || !data.token) return;
        const wsBase = window.location.origin.replace(/^http/, 'ws');
        const ws = wsBase + '/api/guac?token=' + encodeURIComponent(data.token);
        const tunnel = new Guacamole.WebSocketTunnel(ws);
        tunnel.onerror = status => console.error('Tunnel error', status);
        client = new Guacamole.Client(tunnel);
        client.onerror = err => console.error('Client error', err);
        client.onstatechange = state => console.log('Client state', state);
        ref.current!.innerHTML = '';
        ref.current!.appendChild(client.getDisplay().getElement());
        client.connect();
      });
    const disconnect = () => client?.disconnect();
    window.addEventListener('beforeunload', disconnect);
    return () => {
      ignore = true;
      window.removeEventListener('beforeunload', disconnect);
      client?.disconnect();
    };
  }, [type, hostname, port]);

  return <div ref={ref} style={{width:'100vw',height:'100vh',background:'#000'}}/>;
}

export default function GuacPage() {
  return (
    <Suspense>
      <GuacInner />
    </Suspense>
  );
}
