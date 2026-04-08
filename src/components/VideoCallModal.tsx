import { useEffect, useRef } from 'react'
import { X, Video } from 'lucide-react'

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: object) => { dispose: () => void }
  }
}

interface Props {
  roomName: string
  displayName: string
  onClose: () => void
}

export default function VideoCallModal({ roomName, displayName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    const initCall = () => {
      if (!containerRef.current || apiRef.current) return
      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat', 'tileview', 'settings'],
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          MOBILE_APP_PROMO: false,
        },
      })
    }

    if (window.JitsiMeetExternalAPI) {
      initCall()
    } else {
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = initCall
      document.head.appendChild(script)
    }

    return () => {
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [roomName, displayName])

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-white/10 px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <Video className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-semibold">Video Call</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <X className="h-4 w-4" /> Verlaten
        </button>
      </div>
      {/* Jitsi container */}
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  )
}
