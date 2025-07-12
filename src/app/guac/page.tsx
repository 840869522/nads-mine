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
  const username = params.get('username') || '';
  const password = params.get('password') || '';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !type || !hostname || !port) return;
    let client: Guacamole.Client | null = null;
    let ignore = false;
    const queryInit: Record<string, string> = { type, hostname, port };
    if (username) queryInit.username = username;
    if (password) queryInit.password = password;
    const qs = new URLSearchParams(queryInit).toString();
    fetch('/api/token-guac?' + qs)
      .then(r => r.json())
      .then(data => {
        if (ignore || !ref.current || !data.token) return;
        const wsBase = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
        const ws = wsBase + '/connect-guac?token=' + encodeURIComponent(data.token);
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
