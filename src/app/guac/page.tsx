'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import * as Guacamole from 'guacamole-common-js'

export default function GuacPage() {
  const params = useSearchParams();
  const url = params.get('url') || '';
  const token = params.get('token') || '';
  const ds = params.get('ds') || '';
  const id = params.get('id') || '';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !url || !token || !id || !ds) return;
    const ws = url.replace(/^http/, 'ws') + '/websocket-tunnel?token=' + token;
    const tunnel = new Guacamole.WebSocketTunnel(ws);
    const client = new Guacamole.Client(tunnel);
    ref.current.innerHTML = '';
    ref.current.appendChild(client.getDisplay().getElement());
    client.connect(`token=${token}&connection=${id}&GUAC_DATA_SOURCE=${ds}`);
    const disconnect = () => client.disconnect();
    window.addEventListener('beforeunload', disconnect);
    return () => {
      window.removeEventListener('beforeunload', disconnect);
      client.disconnect();
    };
  }, [url, token, ds, id]);

  return <div ref={ref} style={{width:'100vw',height:'100vh',background:'#000'}}/>;
}
