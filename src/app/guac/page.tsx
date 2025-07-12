'use client'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Guacamole from 'guacamole-common-js'

export const dynamic = 'force-dynamic'

function GuacInner() {
  const params = useSearchParams()
  const protocol = params.get('type') || params.get('protocol') || 'vnc'
  const hostname = params.get('hostname') || ''
  const port = params.get('port') || ''
  const username = params.get('username') || ''
  const password = params.get('password') || ''

  const connectionScreenRef = useRef<HTMLDivElement>(null)
  const displayScreenRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const uuidRef = useRef<HTMLSpanElement>(null)

  const clientRef = useRef<Guacamole.Client | null>(null)
  const keyboardRef = useRef<Guacamole.Keyboard | null>(null)
  const pasteListenerRef = useRef<((e: ClipboardEvent) => void) | null>(null)

  const cleanupGuac = () => {
    const client = clientRef.current
    if (client) {
      try { client.disconnect() } catch (_) {}
      clientRef.current = null
    }
    if (uuidRef.current) {
      uuidRef.current.textContent = ''
      //@ts-ignore
      delete uuidRef.current.dataset.uuid
    }
    if (keyboardRef.current) {
      keyboardRef.current.onkeydown = null
      keyboardRef.current.onkeyup = null
      keyboardRef.current.reset()
      keyboardRef.current = null
    }
    if (pasteListenerRef.current) {
      window.removeEventListener('paste', pasteListenerRef.current)
      pasteListenerRef.current = null
    }
  }

  const initializeGuac = (token: string) => {
    if (!displayRef.current) return

    connectionScreenRef.current!.style.display = 'none'
    displayScreenRef.current!.style.display = 'flex'

    const wsBase = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
    const tunnel = new Guacamole.WebSocketTunnel(wsBase + '/connect-guac')

    tunnel.onuuid = uuid => {
      if (uuidRef.current) {
        //@ts-ignore
        uuidRef.current.dataset.uuid = uuid
        uuidRef.current.textContent = `ID: ${uuid}`
      }
    }

    const client = new Guacamole.Client(tunnel)
    clientRef.current = client
    displayRef.current.innerHTML = ''
    displayRef.current.appendChild(client.getDisplay().getElement())

    client.onerror = err => console.error('Guacamole error', err)

    client.onclipboard = (stream, mimetype) => {
      let data = ''
      const reader = new Guacamole.StringReader(stream)
      reader.ontext = text => { data += text }
      reader.onend = () => {
        const textarea = document.getElementById('clipboard-textarea') as HTMLTextAreaElement
        if (textarea) {
          textarea.value = data
          textarea.select()
          try { document.execCommand('copy') } catch (_) {}
          window.getSelection()?.removeAllRanges()
        }
      }
    }

    client.onfile = (stream, mimetype, filename) => {
      stream.sendAck('Ready', Guacamole.Status.Code.SUCCESS)
      const reader = new Guacamole.BlobReader(stream, mimetype)
      reader.onend = () => {
        const file = reader.getBlob()
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 100)
      }
    }

    const mouse = new Guacamole.Mouse(client.getDisplay().getElement())
    mouse.onEach(['mousedown','mouseup','mousemove','mousewheel'], e => client.sendMouseState(e.state))

    const keyboard = new Guacamole.Keyboard(window)
    keyboard.onkeydown = ks => client.sendKeyEvent(1, ks)
    keyboard.onkeyup = ks => client.sendKeyEvent(0, ks)
    keyboardRef.current = keyboard

    const pasteListener = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')
      if (text && clientRef.current) {
        e.preventDefault()
        const stream = clientRef.current.createClipboardStream('text/plain')
        const writer = new Guacamole.StringWriter(stream)
        writer.sendText(text)
        writer.sendEnd()
      }
    }
    window.addEventListener('paste', pasteListener)
    pasteListenerRef.current = pasteListener

    client.connect('token=' + encodeURIComponent(token))
  }

  const connect = async () => {
    if (!protocol || !hostname || !port) return
    const q: Record<string,string> = { type: protocol, hostname, port }
    if (username) q.username = username
    if (password) q.password = password
    const qs = new URLSearchParams(q).toString()
    const res = await fetch('/api/token-guac?' + qs)
    const data = await res.json()
    if (!data.token) throw new Error('No token')
    initializeGuac(data.token)
  }

  useEffect(() => {
    if (hostname && port) {
      connect().catch(err => alert('Connection failed: ' + err.message))
    }
    return () => cleanupGuac()
  }, [protocol, hostname, port, username, password])

  return (
    <div id="app-container" className="w-screen h-screen flex flex-col">
      <div id="connection-screen" ref={connectionScreenRef} className="flex-1 flex items-center justify-center" style={{display:'none'}}>
        <button id="connect-button" onClick={connect} className="border px-4 py-2">Connect</button>
      </div>
      <div id="display-screen" ref={displayScreenRef} className="flex-1 flex-col hidden">
        <div id="display-header" className="flex items-center gap-2 bg-gray-200 p-2">
          <div id="display-title" className="flex-1">Remote Connection</div>
          <span id="display-uuid" ref={uuidRef} className="text-sm cursor-pointer" />
          <button id="close-button" className="border px-2" onClick={() => { cleanupGuac(); connectionScreenRef.current!.style.display='flex'; displayScreenRef.current!.style.display='none'; }}>Disconnect</button>
        </div>
        <div id="display" ref={displayRef} className="flex-1 bg-black" />
      </div>
      <textarea id="clipboard-textarea" style={{position:'absolute', left:'-9999px'}} />
    </div>
  )
}

export default function GuacPage() {
  return (
    <Suspense>
      <GuacInner />
    </Suspense>
  )
}
