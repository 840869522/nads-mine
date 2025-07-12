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

  function cleanup() {
    if (clientRef.current) {
      try { clientRef.current.disconnect() } catch {}
      clientRef.current = null
    }
    if (uuidRef.current) uuidRef.current.textContent = ''
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

  function init(token: string) {
    if (!displayRef.current || !displayScreenRef.current || !connectionScreenRef.current) return

    connectionScreenRef.current.style.display = 'none'
    displayScreenRef.current.style.display = 'flex'

    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/connect-guac'
    const tunnel = new Guacamole.WebSocketTunnel(wsUrl)
    tunnel.onuuid = uuid => { if (uuidRef.current) uuidRef.current.textContent = `ID: ${uuid}` }

    const client = new Guacamole.Client(tunnel)
    clientRef.current = client

    displayRef.current.innerHTML = ''
    displayRef.current.appendChild(client.getDisplay().getElement())

    client.onerror = err => console.error('Guacamole error', err)

    client.onclipboard = (stream, mimetype) => {
      let data = ''
      const reader = new Guacamole.StringReader(stream)
      reader.ontext = t => { data += t }
      reader.onend = () => {
        const ta = document.getElementById('clipboard-textarea') as HTMLTextAreaElement
        if (ta) {
          ta.value = data
          ta.select()
          try { document.execCommand('copy') } catch {}
          window.getSelection()?.removeAllRanges()
        }
      }
    }

    client.onfile = (stream, mimetype, filename) => {
      stream.sendAck('Ready', Guacamole.Status.Code.SUCCESS)
      const reader = new Guacamole.BlobReader(stream, mimetype)
      reader.onend = () => {
        const blob = reader.getBlob()
        const url = URL.createObjectURL(blob)
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
    keyboard.onkeydown = k => client.sendKeyEvent(1, k)
    keyboard.onkeyup = k => client.sendKeyEvent(0, k)
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

    let connectString = `token=${encodeURIComponent(token)}`
    if (protocol === 'rdp') connectString += '&GUAC_AUDIO=audio/L16'
    client.connect(connectString)
  }

  useEffect(() => {
    async function connect() {
      if (!hostname || !port) return
      const settings: Record<string, any> = { hostname, port }
      if (username) settings.username = username
      if (password) settings.password = password

      if (protocol === 'rdp') {
        Object.assign(settings, {
          'ignore-cert': true,
          security: 'any',
          'enable-drive': true,
          'drive-path': '/tmp/guac-drive',
          'create-drive-path': true,
          'enable-printing': true,
          audio: ['audio/L16;rate=44100']
        })
      }
      if (protocol === 'vnc') {
        Object.assign(settings, {
          autoretry: 3,
          color_depth: 24,
          swap_red_blue: false,
          connect_timeout: 15
        })
      }
      const tokenObj = { connection: { type: protocol, settings } }
      const res = await fetch('/api/token-guac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenObj)
      })
      const data = await res.json()
      if (!data.token) throw new Error('Token failed')
      init(data.token)
    }
    connect().catch(err => alert('Connection failed: ' + err.message))
    return () => cleanup()
  }, [protocol, hostname, port, username, password])

  return (
    <div id="app-container" className="w-screen h-screen flex flex-col">
      <div id="connection-screen" ref={connectionScreenRef} className="flex-1 flex items-center justify-center">
        <div id="connection-form" />
      </div>
      <div id="display-screen" ref={displayScreenRef} className="flex-1 flex-col hidden">
        <div id="display-header" className="flex items-center gap-2 bg-gray-200 p-2">
          <div id="display-title" className="flex-1">Remote Connection</div>
          <span id="display-uuid" ref={uuidRef} className="text-sm" />
          <button id="close-button" className="border px-2" onClick={() => {
            cleanup()
            if (connectionScreenRef.current && displayScreenRef.current) {
              connectionScreenRef.current.style.display = 'flex'
              displayScreenRef.current.style.display = 'none'
            }
          }}>Disconnect</button>
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
