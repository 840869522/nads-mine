'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import * as Guacamole from 'guacamole-common-js'

export default function GuacPage() {
  const params = useSearchParams();
  const type = params.get('type') || '';
  const hostname = params.get('hostname') || '';
  const port = params.get('port') || '';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !type || !hostname || !port) return;
    const wsBase = window.location.origin.replace(/^http/, 'ws');
    const ws = wsBase + '/api/guac?' +
      new URLSearchParams({ type, hostname, port }).toString();
    const tunnel = new Guacamole.WebSocketTunnel(ws);
    const client = new Guacamole.Client(tunnel);
    ref.current.innerHTML = '';
    ref.current.appendChild(client.getDisplay().getElement());
    client.connect();
    const disconnect = () => client.disconnect();
    window.addEventListener('beforeunload', disconnect);
    return () => {
      window.removeEventListener('beforeunload', disconnect);
      client.disconnect();
    };
  }, [type, hostname, port]);

  return <div ref={ref} style={{width:'100vw',height:'100vh',background:'#000'}}/>;
}
